/**
 * Atlas Leaders step 2: rank the raw TradingView rows (scripts/tv-leaders.py) into public/leaders.json.
 *   npm run leaders -- <raw.json> [out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { rankLeaders, type TvRow } from '../src/lib/leaders'

const [inFile, outFile = 'public/leaders.json'] = process.argv.slice(2)
if (!inFile) throw new Error('usage: npm run leaders -- <raw.json> [out.json]')
const raw = JSON.parse(readFileSync(inFile, 'utf8')) as TvRow[]
const rep = rankLeaders(raw, new Date().toISOString())
if (rep.universe < 1500 || rep.leaders.length < 10) throw new Error(`result looks broken (universe ${rep.universe}, leaders ${rep.leaders.length}); not writing`)
writeFileSync(outFile, JSON.stringify(rep, null, 1))
console.log(`leaders: universe ${rep.universe}, A ${rep.listA}, B ${rep.listB}, saved ${rep.leaders.length} -> ${outFile}`)
