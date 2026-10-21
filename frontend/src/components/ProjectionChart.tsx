import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Projection } from '../api/types'
import { useI18n } from '../i18n/context'
import { formatDate, formatMoney, toNumber } from '../lib/format'

/** "Tunnel" chart: the expected path with a cautious/optimistic band around it. */
export function ProjectionChart({ projection, target }: { projection: Projection; target: string }) {
  const { t, lang, dir } = useI18n()
  const data = projection.points.map((p) => ({
    date: p.date,
    expected: toNumber(p.expected),
    low: toNumber(p.low),
    high: toNumber(p.high),
    band: [toNumber(p.low), toNumber(p.high)] as [number, number],
  }))
  const targetNum = toNumber(target)

  return (
    <div className="h-72 w-full" dir="ltr" role="img" aria-label={t('chartTitle')}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: dir === 'rtl' ? 8 : 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d, lang).slice(3)} stroke="#64748b" fontSize={11} minTickGap={32} />
          <YAxis tickFormatter={(v: number) => formatMoney(v, lang, { compact: true })} stroke="#64748b" fontSize={11} width={64} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, direction: dir }}
            labelFormatter={(d) => formatDate(String(d), lang)}
            formatter={(v, name) => [Array.isArray(v) ? `${formatMoney(v[0], lang)} – ${formatMoney(v[1], lang)}` : formatMoney(Number(v), lang), name]}
          />
          <Area type="monotone" dataKey="band" name={`${t('chartLow')} – ${t('chartHigh')}`} stroke="none" fill="#6366f1" fillOpacity={0.15} />
          <Line type="monotone" dataKey="expected" name={t('chartExpected')} stroke="#818cf8" strokeWidth={2.5} dot={false} />
          <ReferenceLine y={targetNum} stroke="#34d399" strokeDasharray="6 4" label={{ value: t('chartTarget'), fill: '#34d399', fontSize: 11, position: 'insideTopLeft' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
