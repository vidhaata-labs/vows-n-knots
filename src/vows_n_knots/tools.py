from langchain.tools import tool
from tavily import TavilyClient

from vows_n_knots.config.logging_config import get_logger
from vows_n_knots.config.settings import load_env

load_env()

logger = get_logger(__name__)

tavily_client = TavilyClient()


def _format_results(response: dict) -> str:
    query = response.get("query", "")
    results = response.get("results", []) or []
    if not results:
        return f"No web results found for '{query}'."
    lines = [f"Web results for '{query}':"]
    for index, result in enumerate(results, 1):
        lines.append(f"{index}. {result.get('title', 'Untitled')}")
        lines.append(f"   URL: {result.get('url', '')}")
        content = result.get("content", "")
        if content:
            lines.append(f"   {content}")
    return "\n".join(lines)


@tool
def search_web(topic: str) -> str:
    """Search the web for a given topic and return the results."""
    logger.info(f"Searching the web for the topic : {topic}")
    response = tavily_client.search(topic)
    return _format_results(response)
