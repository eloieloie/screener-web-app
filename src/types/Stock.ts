export interface Stock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
}

export interface AddStockForm {
  symbol: string;
  name: string;
  price: number;
}