"""
LangChain RAG Pipeline for Shopping Copilot

- Loads catalog.jsonl products into LangChain Document objects.
- Embeds documents using HuggingFaceEmbeddings (all-MiniLM-L6-v2).
- Stores vectors in FAISS Vector Database.
- Performs vector similarity search for user queries.
- Connects to Llama 3.1 8B via ARK API (ChatOpenAI) to generate personalized recommendations.
"""
from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI

load_dotenv()

API_KEY = os.getenv("API_KEY") or os.getenv("ARK_API_KEY", "clsk_tm4KcYwm_Z1NkbLphU80m6qLS6Saf_g0yoRpyX4be5MEo7sYwSQo")
MODEL = (os.getenv("MODEL") or os.getenv("ARK_MODEL", "llama3.1:8b")).replace('"', "")
BASE_URL = os.getenv("BASE_URL") or os.getenv("ARK_BASE_URL", "https://soclaas-api.comp.nus.edu.sg/v1")

# Singleton instances
_embedding_model: HuggingFaceEmbeddings | None = None
_vectorstore: FAISS | None = None
_llm: ChatOpenAI | None = None


def get_embedding_model() -> HuggingFaceEmbeddings:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _embedding_model


def get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            api_key=API_KEY,
            base_url=BASE_URL,
            model=MODEL,
            temperature=0.7,
            max_tokens=500,
        )
    return _llm


def load_catalog_documents(max_items: int = 1000) -> list[Document]:
    """Parse catalog.jsonl into LangChain Document objects."""
    catalog_path = os.path.join(os.path.dirname(__file__), "..", "data", "catalog.jsonl")
    docs: list[Document] = []

    if not os.path.exists(catalog_path):
        return docs

    with open(catalog_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= max_items:
                break
            line_str = line.strip()
            if not line_str:
                continue

            data = json.loads(line_str)
            title = data.get("title", "Untitled Product")
            try:
                price_val = float(data.get("price")) if data.get("price") is not None else 19.99
            except (ValueError, TypeError):
                price_val = 19.99

            categories = data.get("categories", [])
            cat_text = " > ".join(categories) if isinstance(categories, list) else str(categories)
            features = data.get("features", [])
            feat_text = " ".join(features) if isinstance(features, list) else str(features)
            desc = data.get("description", [])
            desc_text = " ".join(desc) if isinstance(desc, list) else str(desc)
            store = data.get("store", "Copilot Store")
            asin = data.get("asin") or data.get("parent_asin") or f"PRODUCT_{i}"
            rating = data.get("average_rating", 4.5)
            rating_num = data.get("rating_number", 100)

            content = f"Title: {title}\nStore: {store}\nCategory: {cat_text}\nPrice: ${price_val:.2f}\nFeatures: {feat_text}\nDescription: {desc_text}"

            metadata = {
                "asin": asin,
                "parent_asin": data.get("parent_asin", asin),
                "title": title,
                "price": price_val,
                "category": cat_text,
                "categories": categories if isinstance(categories, list) else [cat_text],
                "features": features if isinstance(features, list) else [feat_text],
                "description": desc if isinstance(desc, list) else [desc_text],
                "store": store,
                "average_rating": rating,
                "rating_number": rating_num,
                "details": data.get("details", {}),
            }

            docs.append(Document(page_content=content, metadata=metadata))

    return docs


VECTORSTORE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "faiss_index")


def get_vectorstore() -> FAISS:
    """Initialize or load persistent FAISS vector database from disk."""
    global _vectorstore
    if _vectorstore is None:
        embeddings = get_embedding_model()
        index_file = os.path.join(VECTORSTORE_DIR, "index.faiss")

        # Load from disk if faiss_index already exists
        if os.path.exists(index_file):
            try:
                _vectorstore = FAISS.load_local(
                    VECTORSTORE_DIR,
                    embeddings,
                    allow_dangerous_deserialization=True,
                )
            except Exception:
                _vectorstore = None

        # Build & save to disk if not loaded
        if _vectorstore is None:
            docs = load_catalog_documents(max_items=1000)
            if docs:
                _vectorstore = FAISS.from_documents(docs, embeddings)
            else:
                dummy = Document(page_content="Shopping Copilot Catalog Initialized", metadata={"asin": "DUMMY"})
                _vectorstore = FAISS.from_documents([dummy], embeddings)

            os.makedirs(VECTORSTORE_DIR, exist_ok=True)
            _vectorstore.save_local(VECTORSTORE_DIR)

    return _vectorstore


def process_rag_turn(
    user_query: str,
    user_profile: dict[str, Any] | None = None,
    history: list[dict[str, str]] | None = None,
    top_k: int = 6,
) -> dict[str, Any]:
    """
    RAG Execution Pipeline:
    1. Construct search query combining user query + user profile interest tags.
    2. Convert query to vector embedding & perform FAISS similarity vector search.
    3. Construct RAG prompt with retrieved document context.
    4. Generate response using ChatOpenAI Llama 3.1 8B.
    5. Return agent response, matched product cards, and metadata.
    """
    vectorstore = get_vectorstore()
    llm = get_llm()

    # Extract user profile interests
    interests: list[str] = []
    if user_profile and isinstance(user_profile.get("interests"), list):
        interests = [str(x) for x in user_profile["interests"]]

    # Combine query text with profile vector context
    search_query = user_query
    if interests:
        search_query += f" Preferred Interests: {', '.join(interests)}"

    # Vector similarity search in FAISS database
    docs_and_scores = vectorstore.similarity_search_with_score(search_query, k=top_k)
    retrieved_docs = [doc for doc, score in docs_and_scores]

    # Format context for LLM prompt
    context_blocks = []
    recommended_products = []

    for i, doc in enumerate(retrieved_docs):
        meta = doc.metadata
        context_blocks.append(
            f"Product {i+1}:\n- Title: {meta.get('title')}\n- Price: ${meta.get('price')}\n- Category: {meta.get('category')}\n- Store: {meta.get('store')}\n- Features: {doc.page_content[:200]}"
        )
        recommended_products.append(meta)

    context_str = "\n\n".join(context_blocks)
    user_name = user_profile.get("name", "Customer") if user_profile else "Customer"

    system_prompt = f"""You are Shopping Copilot, an AI assistant helping {user_name} find the best e-commerce products.

Retrieved Relevant Catalog Products:
{context_str}

User Profile Interests: {', '.join(interests) if interests else 'General'}

Instructions:
1. Be helpful, concise, friendly, and enthusiastic.
2. Recommend the top matching products from the retrieved catalog above.
3. Highlight key features and prices.
4. If the user request is vague, ask 1 clarifying question to narrow down their preference.
5. Do NOT include any emojis in your response.
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query},
    ]

    try:
        response = llm.invoke(messages)
        agent_message = response.content
    except Exception as e:
        agent_message = f"Here are the top product recommendations matching '{user_query}' from our catalog database:"

    # Infer new derived interests from retrieved products and query
    derived_interests: list[str] = []
    for doc in retrieved_docs:
        cat = doc.metadata.get("category", "")
        if cat:
            parts = [p.strip() for p in cat.replace(">", ",").split(",") if p.strip()]
            for p in parts:
                if p not in derived_interests and p not in ["Clothing, Shoes & Jewelry", "General"]:
                    derived_interests.append(p)

    return {
        "agentMessage": agent_message,
        "products": recommended_products,
        "candidateCount": len(docs_and_scores),
        "shouldClarify": "?" in agent_message and ("color" in agent_message.lower() or "size" in agent_message.lower() or "preference" in agent_message.lower() or "which" in agent_message.lower()),
        "derivedInterests": derived_interests[:6],
    }
