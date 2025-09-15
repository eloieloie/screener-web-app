import type { Stock } from '../types/Stock'
import StockCard from './StockCard'
import './StockList.css'

interface StockListProps {
  stocks: Stock[]
  onRemoveStock: (id: string) => void
  onUpdatePrice: (id: string, newPrice: number) => void
}

const StockList = ({ stocks, onRemoveStock, onUpdatePrice }: StockListProps) => {
  return (
    <div className="stock-list">
      {stocks.map(stock => (
        <StockCard 
          key={stock.id}
          stock={stock}
          onRemove={() => onRemoveStock(stock.id)}
          onUpdatePrice={(newPrice) => onUpdatePrice(stock.id, newPrice)}
        />
      ))}
    </div>
  )
}

export default StockList