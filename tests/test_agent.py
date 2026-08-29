import sys
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from starter.agent import Agent


def test_agent_contract():
    agent = Agent()
    session_id = "test_session_123"
    user_profile = {"name": "Tester", "interests": ["Women's Shoes", "Fuzzy Slippers"]}

    agent.reset(session_id, user_profile)

    res = agent.respond(
        session_id=session_id,
        user_message="I am looking for open toe memory foam house slippers",
        turn=1,
        top_k=10,
    )

    assert isinstance(res, dict), "Response must be a dict"
    assert "message" in res, "Response missing 'message'"
    assert "ask_attribute" in res, "Response missing 'ask_attribute'"
    assert "recommendations" in res, "Response missing 'recommendations'"
    assert isinstance(res["recommendations"], list), "'recommendations' must be a list"
    assert len(res["recommendations"]) <= 10, "Max 10 recommendations allowed"

    if res["recommendations"]:
        assert "parent_asin" in res["recommendations"][0], "Recommendation item missing 'parent_asin'"

    print("Agent contract test passed successfully!")


if __name__ == "__main__":
    test_agent_contract()
