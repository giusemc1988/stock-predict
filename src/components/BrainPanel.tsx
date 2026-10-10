import { useMemo, useState } from 'react'
import type { AiRules } from '../lib/aiRules'
import { useLang } from '../lib/i18n'
import type { JournalEntry } from '../lib/journal'
import type { PracticeState } from '../lib/practice'
import { PLAYBOOK, ruleEvidence, STATUS_LABEL } from '../lib/playbook'
import { ask, ASK_QUESTIONS, briefing, evidenceLine, evidenceOpts, experience, tradeLessons, type AskId } from '../lib/jarvis'
import { JarvisAvatar } from './JarvisAvatar'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { canSpeak, DEFAULT_VOICE, sortVoices, speak, stopSpeaking, useVoices, type VoicePrefs } from '../lib/speech'

interface Props {
  state: PracticeState
  rules: AiRules
  journal: JournalEntry[]
  learn: { oldTests: number; newBars: number; journal: JournalEntry[] } | null
  killSwitch: boolean
  priceOf: (symbol: string) => number
  onEditRules: () => void
}

type Tab = 'today' | 'lessons' | 'playbook'

/** Jarvis, the Arc Brain: briefing, Ask Jarvis, lessons and the playbook with its evidence. */
export function BrainPanel({ state, rules, journal, learn, killSwitch, priceOf, onEditRules }: Props) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const pick = (b: { en: string; vi: string }) => (lang === 'vi' ? b.vi : b.en)
  const [tab, setTab] = useState<Tab>('today')
  const [q, setQ] = useState<AskId | null>(null)
  const ev = useMemo(() => ruleEvidence(state.trades, evidenceOpts(rules)), [state.trades, rules])
  const xp = experience(state, ev, learn)
  const brief = rules.jarvisBriefing ? briefing(state, rules, journal, killSwitch) : []
  const lessons = rules.jarvisLessons ? tradeLessons(state) : []
  const answer = q && rules.jarvisAsk ? ask(q, { state, rules, journal, killSwitch, priceOf }) : null
  const mood = killSwitch ? 'warning' : q ? 'speaking' : 'idle'
  const [voice, setVoice] = useLocalStorage<VoicePrefs>('arc.jarvisVoice.v1', DEFAULT_VOICE)
  const voices = sortVoices(useVoices())
  const speech = rules.jarvisSpeech && canSpeak()
  const say = (lines: { en: string; vi: string }[]) => speak(lines.map(pick).join(' '), voice, lang, voices)
  const askAndSay = (id: AskId) => {
    const next = q === id ? null : id
    setQ(next)
    if (!speech) return
    if (next) say(ask(next, { state, rules, journal, killSwitch, priceOf }))
    else stopSpeaking()
  }
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const tabs: [Tab, string, string][] = [
    ['today', 'Today', 'Hôm nay'],
    ...(rules.jarvisLessons ? ([['lessons', 'Lessons', 'Bài học']] as [Tab, string, string][]) : []),
    ['playbook', 'Playbook', 'Sổ tay'],
  ]
  const shown: Tab = tabs.some(([id]) => id === tab) ? tab : 'today'

  return (
    <div className="autolearn brain">
      <div className="brain-head">
        <JarvisAvatar size={48} mood={mood} motion={rules.jarvisMotion} />
        <div>
          <h3>Jarvis</h3>
          <p className="muted al-note">{L("The Arc Brain · your practice trading mentor", 'Bộ não Arc · người hướng dẫn luyện tập giao dịch')}</p>
        </div>
      </div>
      <p className="al-brain muted">
        {L(
          'I learn from every paper trade and check each one against rules experienced traders use. I count experience in practice trades, not years, and I call a rule proven only when our own paper trades back it up. Nothing here has beaten buying and holding yet. Paper only, not financial advice.',
          'Tôi học từ mỗi lệnh thử và kiểm tra từng lệnh theo các quy tắc của trader kinh nghiệm. Tôi tính kinh nghiệm bằng số lệnh luyện tập, không phải số năm, và chỉ gọi một quy tắc là đã chứng minh khi chính lệnh thử của chúng ta xác nhận. Chưa có gì ở đây thắng được mua và giữ. Chỉ thử nghiệm, không phải lời khuyên đầu tư.',
        )}
      </p>

      <div className="al-tiles brain-tiles">
        <div>
          <span>{L('Practice trades', 'Lệnh luyện tập')}</span>
          <b>{xp.practiceTrades}</b>
        </div>
        <div>
          <span>{L('Bars replayed', 'Nến đã chạy lại')}</span>
          <b>{xp.replayed.toLocaleString('en-US')}</b>
        </div>
        <div>
          <span>{L('Rules proven', 'Quy tắc đã chứng minh')}</span>
          <b className={xp.proven ? 'up' : ''}>
            {xp.proven} / {xp.rules}
          </b>
        </div>
        <div>
          <span>{L('Trades reviewed', 'Lệnh đã đánh giá')}</span>
          <b>{xp.reviewed}</b>
        </div>
      </div>

      <div className="al-tabs" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(([id, en, vi]) => (
          <button key={id} className={shown === id ? 'on' : ''} onClick={() => setTab(id)}>
            {L(en, vi)}
          </button>
        ))}
      </div>

      {shown === 'today' && (
        <>
          {rules.jarvisBriefing && (
            <div className="al-card">
              <div className="al-report-head">
                <div className="al-kicker">{L('MORNING BRIEFING', 'BẢN TIN BUỔI SÁNG')}</div>
                {speech && (
                  <button className="pr-rescan" onClick={() => say(brief)}>
                    🔊 {L('Read aloud', 'Đọc to')}
                  </button>
                )}
              </div>
              <ul className="brain-list">
                {brief.map((b, i) => (
                  <li key={i}>{pick(b)}</li>
                ))}
              </ul>
            </div>
          )}
          {rules.jarvisAsk && (
            <div className="al-card">
              <div className="al-kicker">{L('ASK JARVIS', 'HỎI JARVIS')}</div>
              <div className="brain-ask">
                {(Object.keys(ASK_QUESTIONS) as AskId[]).map((id) => (
                  <button key={id} className={q === id ? 'on' : ''} onClick={() => askAndSay(id)}>
                    {pick(ASK_QUESTIONS[id])}
                  </button>
                ))}
              </div>
              {answer && (
                <div className="brain-answer">
                  <JarvisAvatar size={24} mood="speaking" motion={false} />
                  <ul>
                    {answer.map((a, i) => (
                      <li key={i}>{pick(a)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="muted al-note">{L('Answers come from the app’s own records. No AI service or API key is used.', 'Câu trả lời lấy từ dữ liệu của chính ứng dụng. Không dùng dịch vụ AI hay khóa API.')}</p>
            </div>
          )}
          {rules.jarvisSpeech && (
            <div className="al-card">
              <div className="al-kicker">{L("JARVIS'S VOICE", 'GIỌNG JARVIS')}</div>
              {!canSpeak() ? (
                <p className="muted al-note">{L("This browser can't speak. Try Chrome, Edge or Safari.", 'Trình duyệt này không đọc được. Hãy thử Chrome, Edge hoặc Safari.')}</p>
              ) : (
                <div className="brain-voice">
                  <label>
                    <span>{L('Voice', 'Giọng')}</span>
                    <select value={voice.voice} onChange={(e) => setVoice({ ...voice, voice: e.target.value })}>
                      <option value="">{L('Default for the app language', 'Mặc định theo ngôn ngữ ứng dụng')}</option>
                      {voices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>
                      {L('Speed', 'Tốc độ')} {voice.rate.toFixed(1)}x
                    </span>
                    <input type="range" min={0.5} max={2} step={0.1} value={voice.rate} onChange={(e) => setVoice({ ...voice, rate: +e.target.value })} />
                  </label>
                  <label>
                    <span>
                      {L('Pitch', 'Cao độ')} {voice.pitch.toFixed(1)}
                    </span>
                    <input type="range" min={0} max={2} step={0.1} value={voice.pitch} onChange={(e) => setVoice({ ...voice, pitch: +e.target.value })} />
                  </label>
                  <button className="pr-rescan" onClick={() => say([{ en: "Hello, I'm Jarvis. This is how I sound.", vi: 'Xin chào, tôi là Jarvis. Đây là giọng của tôi.' }])}>
                    ▶ {L('Test voice', 'Nghe thử')}
                  </button>
                  <p className="muted al-note">{L("Uses your device's built-in voices, free and with no key. Male, female and Vietnamese voices depend on what your device has installed.", 'Dùng giọng có sẵn trên thiết bị, miễn phí và không cần khóa. Giọng nam, nữ và tiếng Việt tùy vào thiết bị đã cài.')}</p>
                </div>
              )}
            </div>
          )}
          {!rules.jarvisBriefing && !rules.jarvisAsk && <p className="muted">{L('Briefing and Ask Jarvis are off in AI rules.', 'Bản tin và Hỏi Jarvis đang tắt trong Quy tắc AI.')}</p>}
        </>
      )}

      {shown === 'lessons' && (
        <div className="al-card">
          <div className="al-kicker">{L('LESSONS FROM REVIEWED TRADES', 'BÀI HỌC TỪ LỆNH ĐÃ ĐÁNH GIÁ')}</div>
          {lessons.length ? (
            lessons.map((l, i) => (
              <div key={i} className={`brain-lesson ${l.tone}`}>
                <em>{when(l.time)}</em>
                {pick(l)}
              </div>
            ))
          ) : (
            <p className="muted">{L('No reviewed trades yet. Lessons appear after practice trades close.', 'Chưa có lệnh nào được đánh giá. Bài học sẽ xuất hiện sau khi lệnh luyện tập đóng.')}</p>
          )}
        </div>
      )}

      {shown === 'playbook' && (
        <div className="al-card">
          <div className="al-kicker">{L('PLAYBOOK · RULES FROM EXPERIENCED TRADERS', 'SỔ TAY · QUY TẮC CỦA TRADER KINH NGHIỆM')}</div>
          <p className="muted al-note">
            {L(
              `A rule is judged after ${rules.minSample} trades that follow it and ${Math.max(5, Math.round(rules.minSample / 3))} that break it. Proven means following it won at least ${rules.learnEdgeMarginPct} points more often and made money on average.${rules.jarvisGate ? ' The gate is on: practice skips buys that break a proven rule.' : ''}`,
              `Một quy tắc được đánh giá sau ${rules.minSample} lệnh tuân theo và ${Math.max(5, Math.round(rules.minSample / 3))} lệnh vi phạm. Đã chứng minh nghĩa là tuân theo thắng nhiều hơn ít nhất ${rules.learnEdgeMarginPct} điểm và có lãi trung bình.${rules.jarvisGate ? ' Cổng đang bật: luyện tập bỏ qua lệnh mua vi phạm quy tắc đã chứng minh.' : ''}`,
            )}
          </p>
          {PLAYBOOK.map((r) => {
            const e = ev.find((x) => x.id === r.id)!
            return (
              <div key={r.id} className="brain-rule">
                <b>{lang === 'vi' ? r.vi.name : r.en.name}</b>
                <span className={`st ${e.status}`}>{pick(STATUS_LABEL[e.status])}</span>
                <span className="muted">
                  {lang === 'vi' ? r.vi.why : r.en.why} {pick(evidenceLine(e))}
                </span>
              </div>
            )
          })}
          <button className="al-save" onClick={onEditRules}>
            {L('Jarvis settings (AI rules)', 'Cài đặt Jarvis (Quy tắc AI)')}
          </button>
        </div>
      )}
    </div>
  )
}
