from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, Market, Ticker
from app.models import Watchlist, WatchlistStock
from app.schemas.watchlist import WatchlistAddIn, WatchlistItemOut, WatchlistOut, WatchlistReorderIn
from app.services.market.service import quote_to_dict
from app.utils.errors import AppError, SymbolNotFoundError
from app.utils.tickers import normalise_ticker

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])
MAX_ITEMS = 50


def _watchlist(db, user) -> Watchlist:
    wl = db.scalar(select(Watchlist).where(Watchlist.user_id == user.id))
    if wl is None:
        wl = Watchlist(user_id=user.id)
        db.add(wl)
        db.commit()
    return wl


def _meta(market: Market, stale: bool = False) -> dict:
    return {"source": market.source, "source_label": market.source_label, "data_note": market.data_note,
            "stale": stale, "fetched_at": None}


@router.get("", response_model=WatchlistOut, summary="Your watchlist, in saved order, with latest quotes")
def list_watchlist(user: CurrentUser, db: DbSession, market: Market) -> WatchlistOut:
    wl = _watchlist(db, user)
    stocks = list(wl.stocks)
    quotes, error, stale = {}, None, False
    if stocks:
        try:
            quotes, stale = market.quotes([s.ticker for s in stocks])
        except AppError as exc:  # the list itself is still valid without prices
            error = exc.message
    items = [
        WatchlistItemOut(
            ticker=s.ticker, position=i, added_at=s.added_at,
            quote=quote_to_dict(quotes[s.ticker]) if s.ticker in quotes else None,
        )
        for i, s in enumerate(stocks)
    ]
    return WatchlistOut(items=items, quotes_error=error, meta=_meta(market, stale))


@router.post("", response_model=WatchlistItemOut, status_code=status.HTTP_201_CREATED, summary="Add a stock")
def add_to_watchlist(body: WatchlistAddIn, user: CurrentUser, db: DbSession, market: Market) -> WatchlistItemOut:
    ticker = normalise_ticker(body.ticker)
    wl = _watchlist(db, user)
    if any(s.ticker == ticker for s in wl.stocks):
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"{ticker} is already in your watchlist.")
    if len(wl.stocks) >= MAX_ITEMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Watchlists are limited to {MAX_ITEMS} stocks.")

    # Reject symbols the provider says do not exist; if the provider is merely unavailable,
    # still allow the add so a temporary outage does not block the user.
    try:
        market.quote(ticker)
    except SymbolNotFoundError:
        raise
    except AppError:
        pass

    position = (db.scalar(select(func.max(WatchlistStock.position)).where(WatchlistStock.watchlist_id == wl.id)) or -1) + 1
    row = WatchlistStock(watchlist_id=wl.id, ticker=ticker, position=position)
    db.add(row)
    db.commit()
    return WatchlistItemOut(ticker=row.ticker, position=row.position, added_at=row.added_at)


@router.delete("/{ticker}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a stock")
def remove_from_watchlist(ticker: Ticker, user: CurrentUser, db: DbSession) -> Response:
    wl = _watchlist(db, user)
    row = next((s for s in wl.stocks if s.ticker == ticker), None)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{ticker} is not in your watchlist.")
    db.delete(row)
    db.flush()
    for i, s in enumerate(s for s in wl.stocks if s.ticker != ticker):  # keep positions contiguous
        s.position = i
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/order", response_model=list[str], summary="Reorder the watchlist")
def reorder(body: WatchlistReorderIn, user: CurrentUser, db: DbSession) -> list[str]:
    wl = _watchlist(db, user)
    requested = [normalise_ticker(t) for t in body.tickers]
    existing = {s.ticker: s for s in wl.stocks}
    if len(set(requested)) != len(requested) or set(requested) != set(existing):
        raise HTTPException(
            422,
            detail="The new order must contain exactly the tickers currently in your watchlist.",
        )
    for i, t in enumerate(requested):
        existing[t].position = i
    db.commit()
    return requested
