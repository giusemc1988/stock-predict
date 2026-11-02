/** Liquid, widely traded names across sectors, shared by the replay labs. Fixed on purpose: Yahoo keeps
 *  no history of each day's top-gainer list, so a replay cannot copy the live picker's universe. */
export const STOCKS = `AAPL MSFT NVDA AMZN GOOGL META TSLA AVGO AMD NFLX ADBE CRM ORCL INTC QCOM MU TXN AMAT LRCX KLAC
PLTR SNOW SHOP UBER ABNB COIN HOOD SOFI RIVN LCID NIO PLUG MARA RIOT SMCI ARM PANW CRWD NET DDOG
JPM BAC WFC C GS MS SCHW V MA PYPL AXP
XOM CVX OXY SLB COP HAL DVN
UNH LLY JNJ PFE MRK ABBV MRNA BMY GILD AMGN
WMT COST TGT HD LOW NKE SBUX MCD DIS KO PEP
BA CAT DE GE HON LMT RTX UPS FDX F GM
T VZ TMUS CMCSA
SPY QQQ IWM`.split(/\s+/).filter(Boolean)
