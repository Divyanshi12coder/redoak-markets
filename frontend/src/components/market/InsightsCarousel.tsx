import { Carousel, CarouselItem } from '../ui/Carousel'
import { Icon, type IconName } from '../ui/Icon'

const INSIGHTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'chart',
    title: 'RSI: speed of price change',
    body: 'The Relative Strength Index compares recent gains with recent losses on a 0-100 scale. Readings above 70 are traditionally called overbought and below 30 oversold - conditions that can persist for long stretches.',
  },
  {
    icon: 'layers',
    title: 'Moving averages & crossovers',
    body: 'SMAs and EMAs smooth price into a trend line. A short average crossing a longer one (for example EMA 20 over EMA 50) is read as a possible momentum change, not a guarantee.',
  },
  {
    icon: 'brain',
    title: 'Walk-forward validation',
    body: 'Markets are time series, so shuffling history leaks the future into training. RedOak trains on the past and tests on what comes next, with an embargo gap, then compares against a naive baseline.',
  },
  {
    icon: 'alert',
    title: 'Unusual activity ≠ direction',
    body: 'A volume spike or outsized move is flagged when it is statistically unusual for that stock. It says something happened - not whether the price will go up or down next.',
  },
  {
    icon: 'shield',
    title: 'Signals are not predictions',
    body: 'Every score on RedOak describes current conditions and historical patterns. Indicators lag, regimes change and back-tests flatter - treat outputs as one input among many.',
  },
]

export function InsightsCarousel() {
  return (
    <Carousel label="market insight cards">
      {INSIGHTS.map((i) => (
        <CarouselItem key={i.title} className="sm:w-[22rem]">
          <article className="card card-hover h-full p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-oak-50 text-oak-700">
              <Icon name={i.icon} />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold text-oak-900">{i.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{i.body}</p>
          </article>
        </CarouselItem>
      ))}
    </Carousel>
  )
}
