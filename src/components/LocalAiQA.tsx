import { useState } from 'react'
import type { AiRules } from '../lib/aiRules'
import { answerQuestion } from '../lib/localJarvis'
import type { PracticeState } from '../lib/practice'
import { useLang } from '../lib/i18n'

interface Props {
  rules: AiRules
  practice: PracticeState
}

export function LocalAiQA({ rules, practice }: Props) {
  const lang = useLang()
  const vi = lang === 'vi'
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!rules.localQA) {
    return null
  }

  const ask = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)

    try {
      const result = await answerQuestion(question, { trades: practice.trades, events: [] }, rules)
      if (result) {
        setAnswer(result)
      } else {
        setError(vi ? 'Ollama không hoạt động hoặc bị lỗi.' : 'Ollama unavailable or error.')
      }
    } catch (e) {
      setError(vi ? 'Lỗi khi hỏi Local AI.' : 'Error asking Local AI.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bf-qa">
      <h4>{vi ? 'Hỏi Local AI' : 'Ask Local AI'}</h4>
      <div className="qa-input-group">
        <input
          type="text"
          placeholder={vi ? 'Hỏi về lệnh hoặc quy tắc…' : 'Ask about trades or rules…'}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && ask()}
          disabled={loading}
        />
        <button onClick={ask} disabled={loading || !question.trim()} className={loading ? 'loading' : ''}>
          {loading ? (vi ? 'Đang hỏi…' : 'Asking…') : vi ? 'Hỏi' : 'Ask'}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
      {answer && <p className="qa-answer">{answer}</p>}
    </div>
  )
}
