import type { Stock } from '../types/Stock'
import StockCard from './StockCard'

interface StockListProps {
  stocks: Stock[]
  onRemoveStock: (id: string) => void
}

const StockList = ({ stocks, onRemoveStock }: StockListProps) => {
  return (
    <div className="row g-3">
      {stocks.map(stock => (
        <div key={stock.id} className="col-lg-4 col-md-6 col-sm-12">
          <StockCard 
            stock={stock}
            onRemove={() => onRemoveStock(stock.id)}
          />
        </div>
      ))}
    </div>
  )
}

export default StockList