import json
import logging
import re
from typing import Dict, Any, Optional
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

TAVILY_API_URL = "https://api.tavily.com/search"


def _clean_text(val: str, max_len: int = 1500) -> str:
    if not val:
        return ""
    clean = re.sub(r"\s+", " ", val).strip()
    return clean[:max_len]


async def fetch_page_metadata_fallback(url: str) -> Dict[str, Any]:
    """Lightweight public webpage scraper fallback if Tavily is unavailable or URL is directly provided."""
    if not url or not url.strip():
        return {}

    target_url = url.strip()
    if not target_url.startswith("http"):
        target_url = f"https://{target_url}"

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(target_url, headers=headers)
            if resp.status_code == 200:
                html = resp.text
                # Extract page title
                title_match = re.search(r"<title>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
                title = title_match.group(1).strip() if title_match else ""
                
                # Extract meta description
                desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, flags=re.IGNORECASE | re.DOTALL)
                meta_desc = desc_match.group(1).strip() if desc_match else ""

                # Extract first clean body paragraphs / text
                body_clean = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
                text_snippets = re.findall(r"<(?:p|h1|h2|h3|li)[^>]*>(.*?)</(?:p|h1|h2|h3|li)>", body_clean, flags=re.DOTALL | re.IGNORECASE)
                clean_snippets = [re.sub(r"<[^>]+>", "", s).strip() for s in text_snippets if len(s.strip()) > 30][:6]

                return {
                    "source": "direct_url_scrape",
                    "title": _clean_text(title, 150),
                    "description": _clean_text(meta_desc, 400),
                    "snippets": clean_snippets,
                    "url": target_url,
                }
    except Exception as err:
        logger.warning(f"Direct fallback scraping for '{target_url}' failed gracefully: {err}")

    return {}


async def extract_company_intelligence(
    company_name: str,
    company_url: str = "",
) -> Dict[str, Any]:
    """
    Extract company background, tech stack, and business model using Tavily Web Search API.
    Gracefully degrades to direct webpage fallback or clean default profile if unreachable.
    Complies with FR-13 and NFR-2.
    """
    clean_name = company_name.strip() if company_name else "Target Company"
    settings = get_settings()
    tavily_key = settings.tavily_api_key

    company_data: Dict[str, Any] = {
        "company_name": clean_name,
        "company_url": company_url.strip() if company_url else "",
        "summary": "",
        "tech_stack": [],
        "culture_and_values": [],
        "key_products": [],
        "source": "heuristic_fallback",
    }

    # 1. Try Tavily Search API if key is configured
    if tavily_key:
        try:
            search_query = f"{clean_name} company overview engineering tech stack products culture"
            payload = {
                "api_key": tavily_key,
                "query": search_query,
                "search_depth": "basic",
                "include_answer": True,
                "max_results": 4,
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(TAVILY_API_URL, json=payload)
                if resp.status_code == 200:
                    tavily_res = resp.json()
                    tavily_answer = tavily_res.get("answer", "")
                    results = tavily_res.get("results", [])

                    snippets = [r.get("content", "") for r in results if r.get("content")]
                    combined_summary = (tavily_answer + " " + " ".join(snippets[:2])).strip()

                    company_data["summary"] = _clean_text(combined_summary, 1000)
                    company_data["source"] = "tavily_search"
                    company_data["raw_snippets"] = [_clean_text(s, 300) for s in snippets[:4]]

                    logger.info(f"Successfully retrieved Tavily intelligence for '{clean_name}'.")
                    return company_data
        except Exception as e:
            logger.warning(f"Tavily search API error for '{clean_name}': {e}. Falling back to URL scraper.")

    # 2. Fallback to direct URL scraping if URL provided
    if company_url:
        fallback_meta = await fetch_page_metadata_fallback(company_url)
        if fallback_meta:
            desc = fallback_meta.get("description") or ""
            snippets = fallback_meta.get("snippets") or []
            company_data["summary"] = _clean_text(f"{desc} {' '.join(snippets)}", 800)
            company_data["source"] = "direct_url_scrape"
            return company_data

    # 3. Default clean profile
    company_data["summary"] = f"{clean_name} is an active industry organization hiring for technical and operational roles."
    return company_data
