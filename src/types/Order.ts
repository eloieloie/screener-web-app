export type OrderVariety = 'regular' | 'amo';
export type TransactionType = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type ProductType = 'CNC' | 'MIS' | 'NRML';
export type OrderValidity = 'DAY' | 'IOC';

export interface OrderParams {
  variety: OrderVariety;
  exchange: 'NSE' | 'BSE';
  tradingsymbol: string;
  transaction_type: TransactionType;
  order_type: OrderType;
  quantity: number;
  product: ProductType;
  price?: number;
  trigger_price?: number;
  validity: OrderValidity;
}

export interface OrderPlaceResponse {
  success: boolean;
  data: { order_id: string };
  timestamp: string;
}

export interface KiteOrder {
  order_id: string;
  tradingsymbol: string;
  exchange: string;
  transaction_type: string;
  order_type: string;
  quantity: number;
  price: number;
  status: string;
  status_message?: string;
  order_timestamp: string;
  product: string;
}

export interface OrdersResponse {
  success: boolean;
  data: KiteOrder[];
  timestamp: string;
}
