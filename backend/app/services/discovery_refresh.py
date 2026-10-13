"""Prepare the two index snapshots without delaying startup or user requests."""

import asyncio
import logging

from app.services.company_discovery_service import discover_company_sectors
from app.services.relationship_service import discover_relationships

logger = logging.getLogger(__name__)


async def refresh_discovery_snapshots():
    while True:
        results = await asyncio.gather(
            discover_company_sectors(refresh=True),
            discover_relationships(3, None, refresh=True),
            return_exceptions=True,
        )
        if any(isinstance(result, Exception) for result in results):
            logger.warning("A procurement discovery snapshot could not be refreshed")
        await asyncio.sleep(300)
