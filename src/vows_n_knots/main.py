from langchain.agents import create_agent
from langchain.messages import HumanMessage

from vows_n_knots.adapters.model import create_chat_model
from vows_n_knots.config.logging_config import configure_logging, get_logger
from vows_n_knots.config.settings import load_settings

_settings = load_settings()
configure_logging(_settings.log_level)

# Agents build the sub-agents at import time, so logging has to be configured first.
from vows_n_knots.agents import delegate_to_sub_agent_1, delegate_to_sub_agent_2
from vows_n_knots.prompts import USER_PROMPT_FOR_MAIN_AGENT, WEDDING_PLANNER_AGENT_PROMPT

logger = get_logger(__name__)


def main() -> None:
    logger.info("Asking user for their requirements...")
    user_requirements = input("Please enter your requirements and preferences for your wedding:\n")

    updated_system_prompt = WEDDING_PLANNER_AGENT_PROMPT.format(requirements=user_requirements)

    logger.info("Initializing main wedding planner agent...")
    main_wedding_planner_agent = create_agent(
        model=create_chat_model(),
        tools=[delegate_to_sub_agent_1, delegate_to_sub_agent_2],
        name="MainWeddingPlannerAgent",
        system_prompt=updated_system_prompt,
    )

    logger.info("invoking main wedding planner agent...")
    main_wedding_planner_agent_response = main_wedding_planner_agent.invoke(
        {"messages": [HumanMessage(content=USER_PROMPT_FOR_MAIN_AGENT)]}
    )

    print("\nMain Wedding Planner Agent's response: ")
    print(main_wedding_planner_agent_response["messages"][-1].content)


if __name__ == "__main__":
    main()
