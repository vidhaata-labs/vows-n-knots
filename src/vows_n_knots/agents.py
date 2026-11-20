from langchain.agents import create_agent
from langchain.messages import HumanMessage
from langchain.tools import tool

from vows_n_knots.adapters.model import create_chat_model
from vows_n_knots.config.logging_config import get_logger
from vows_n_knots.tools import search_web

logger = get_logger(__name__)

logger.info("Initializing SubAgent1...")
sub_agent_1 = create_agent(
    model=create_chat_model(),
    tools=[search_web],
    name="SubAgent1",
)
logger.info("Initializing SubAgent2...")
sub_agent_2 = create_agent(
    model=create_chat_model(),
    tools=[search_web],
    name="SubAgent2",
)


@tool
def delegate_to_sub_agent_1(query: str) -> str:
    """Search the web for a given topic by delegating to SubAgent1 to do so"""
    logger.info(f"Delegating query to SubAgent1: {query}")
    response = sub_agent_1.invoke({"messages": [HumanMessage(content=query)]})
    return response["messages"][-1].content


@tool
def delegate_to_sub_agent_2(query: str) -> str:
    """Search the web for a given topic by delegating to SubAgent2 to do so"""
    logger.info(f"Delegating query to SubAgent2: {query}")
    response = sub_agent_2.invoke({"messages": [HumanMessage(content=query)]})
    return response["messages"][-1].content
