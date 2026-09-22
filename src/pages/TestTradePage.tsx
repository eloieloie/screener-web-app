/**
 * TEMPORARY PAGE — Trade Plan Test
 *
 * Purpose: Place a single live order on the connected Zerodha account to check
 *          whether the current Kite Connect plan/subscription permits order
 *          placement (vs. read-only quote/historical access).
 *
 * WARNING: This places REAL orders with REAL money. Defaults are chosen to be
 *          as low-risk as possible (LIMIT order, quantity 1, price pre-filled
 *          far from LTP), but the user is fully responsible for the values
 *          entered before confirming.
 *
 * Remove this page once the plan has been verified.
 */

import { useState, useCallback } from 'react';
import KiteConnectAPI from '../services/kiteConnectAPI';
import type { OrderParams, TransactionType, OrderType, ProductType, KiteOrder } from '../types/Order';

type Phase = 'idle' | 'confirming' | 'placing' | 'placed' | 'error';

const DEFAULT_FORM = {
  exchange: 'NSE' as 'NSE' | 'BSE',
  tradingsymbol: '',
  transaction_type: 'BUY' as TransactionType,
  order_type: 'LIMIT' as OrderType,
  quantity: 1,
  product: 'CNC' as ProductType,
  price: '',
  trigger_price: '',
};

const TestTradePage = () => {
  const kiteAPI = KiteConnectAPI.getInstance();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  const [orders, setOrders] = useState<KiteOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const needsPrice = form.order_type === 'LIMIT' || form.order_type === 'SL';
  const needsTrigger = form.order_type === 'SL' || form.order_type === 'SL-M';

  const isFormValid =
    form.tradingsymbol.trim().length > 0 &&
    form.quantity > 0 &&
    (!needsPrice || Number(form.price) > 0) &&
    (!needsTrigger || Number(form.trigger_price) > 0);

  const updateField = <K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirmClick = () => {
    setErrorMsg('');
    setPhase('confirming');
  };

  const handlePlaceOrder = useCallback(async () => {
    setPhase('placing');
    setErrorMsg('');
    try {
      const params: OrderParams = {
        variety: 'regular',
        exchange: form.exchange,
        tradingsymbol: form.tradingsymbol.trim().toUpperCase(),
        transaction_type: form.transaction_type,
        order_type: form.order_type,
        quantity: Number(form.quantity),
        product: form.product,
        validity: 'DAY',
      };
      if (needsPrice) params.price = Number(form.price);
      if (needsTrigger) params.trigger_price = Number(form.trigger_price);

      const orderId = await kiteAPI.placeOrder(params);
      setLastOrderId(orderId);
      setPhase('placed');
      await refreshOrders();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to place order');
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, needsPrice, needsTrigger, kiteAPI]);

  const refreshOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const list = await kiteAPI.getOrders();
      setOrders(list.slice().reverse());
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [kiteAPI]);

  const handleCancelOrder = useCallback(async (orderId: string) => {
    setCancellingId(orderId);
    setOrdersError('');
    try {
      await kiteAPI.cancelOrder('regular', orderId);
      await refreshOrders();
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  }, [kiteAPI, refreshOrders]);

  const reset = () => {
    setForm(DEFAULT_FORM);
    setPhase('idle');
    setErrorMsg('');
    setLastOrderId(null);
  };

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <div className="d-flex align-items-center gap-2 mb-1">
        <h4 className="mb-0">🧪 Trade Plan Test</h4>
        <span className="badge bg-warning text-dark">TEMP</span>
      </div>
      <p className="text-muted small mb-4">
        Places a single live order via Kite Connect to check whether the current plan
        permits order placement (as opposed to read-only quote/historical access).
      </p>

      <div className="alert alert-danger">
        <strong>⚠️ Live trading.</strong> This places a REAL order with REAL money on your
        connected Zerodha account. Double-check every field before confirming. Defaults use a
        LIMIT order so it will not fill unless the price you set is actually reachable — but
        you are responsible for the values you enter.
      </div>

      {!kiteAPI.isReady() && (
        <div className="alert alert-warning d-flex align-items-center gap-2">
          <span>⚠️</span>
          <span>You are not logged in to Zerodha. Please log in from the Dashboard first.</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="alert alert-danger d-flex justify-content-between align-items-start">
          <div><strong>Error:</strong> {errorMsg}</div>
          <button className="btn btn-sm btn-outline-danger" onClick={reset}>Reset</button>
        </div>
      )}

      {phase !== 'placed' && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="card-title">Order details</h6>

            <div className="row g-3">
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Exchange</label>
                <select
                  className="form-select form-select-sm"
                  value={form.exchange}
                  onChange={e => updateField('exchange', e.target.value as 'NSE' | 'BSE')}
                  disabled={phase !== 'idle'}
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              <div className="col-6 col-md-8">
                <label className="form-label small fw-semibold">Trading symbol</label>
                <input
                  type="text"
                  className="form-control form-control-sm text-uppercase"
                  placeholder="e.g. TCS"
                  value={form.tradingsymbol}
                  onChange={e => updateField('tradingsymbol', e.target.value)}
                  disabled={phase !== 'idle'}
                />
              </div>

              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Transaction</label>
                <select
                  className="form-select form-select-sm"
                  value={form.transaction_type}
                  onChange={e => updateField('transaction_type', e.target.value as TransactionType)}
                  disabled={phase !== 'idle'}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Product</label>
                <select
                  className="form-select form-select-sm"
                  value={form.product}
                  onChange={e => updateField('product', e.target.value as ProductType)}
                  disabled={phase !== 'idle'}
                >
                  <option value="CNC">CNC (delivery)</option>
                  <option value="MIS">MIS (intraday)</option>
                  <option value="NRML">NRML (F&O carry-forward)</option>
                </select>
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Quantity</label>
                <input
                  type="number"
                  min={1}
                  className="form-control form-control-sm"
                  value={form.quantity}
                  onChange={e => updateField('quantity', Number(e.target.value))}
                  disabled={phase !== 'idle'}
                />
              </div>

              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold">Order type</label>
                <select
                  className="form-select form-select-sm"
                  value={form.order_type}
                  onChange={e => updateField('order_type', e.target.value as OrderType)}
                  disabled={phase !== 'idle'}
                >
                  <option value="LIMIT">LIMIT</option>
                  <option value="MARKET">MARKET</option>
                  <option value="SL">SL (stop-loss limit)</option>
                  <option value="SL-M">SL-M (stop-loss market)</option>
                </select>
              </div>
              {needsPrice && (
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-semibold">Price (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    className="form-control form-control-sm"
                    value={form.price}
                    onChange={e => updateField('price', e.target.value)}
                    disabled={phase !== 'idle'}
                  />
                </div>
              )}
              {needsTrigger && (
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-semibold">Trigger price (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    className="form-control form-control-sm"
                    value={form.trigger_price}
                    onChange={e => updateField('trigger_price', e.target.value)}
                    disabled={phase !== 'idle'}
                  />
                </div>
              )}
            </div>

            {form.order_type === 'MARKET' && (
              <div className="alert alert-warning small mt-3 mb-0">
                MARKET orders fill immediately at the best available price — there is no price
                protection. Prefer LIMIT for a plan test.
              </div>
            )}

            {phase === 'idle' && (
              <button
                className="btn btn-danger mt-3"
                disabled={!isFormValid || !kiteAPI.isReady()}
                onClick={handleConfirmClick}
              >
                Review order…
              </button>
            )}

            {phase === 'confirming' && (
              <div className="alert alert-warning mt-3 mb-0">
                <p className="mb-2">
                  Confirm: <strong>{form.transaction_type} {form.quantity}</strong> ×{' '}
                  <strong>{form.tradingsymbol.toUpperCase()}</strong> on <strong>{form.exchange}</strong>
                  {' '}— {form.order_type}
                  {needsPrice && ` @ ₹${form.price}`}
                  {needsTrigger && ` (trigger ₹${form.trigger_price})`}
                  {' '}— product <strong>{form.product}</strong>.
                </p>
                <p className="mb-3 small">This will place a real order on your Zerodha account. Are you sure?</p>
                <div className="d-flex gap-2">
                  <button className="btn btn-danger btn-sm" onClick={handlePlaceOrder}>
                    Yes, place this real order
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setPhase('idle')}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {phase === 'placing' && (
              <div className="d-flex align-items-center gap-2 text-muted small mt-3">
                <span className="spinner-border spinner-border-sm" />
                Placing order…
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'placed' && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="card-title text-success">✅ Order placed</h6>
            <p className="small mb-3">
              Kite accepted the order request — <strong>order_id: {lastOrderId}</strong>.
              This confirms your plan permits order placement. Check the order book below for
              its actual status (it may still be REJECTED by risk checks or exchange rules).
            </p>
            <button className="btn btn-outline-secondary btn-sm" onClick={reset}>
              Place another test order
            </button>
          </div>
        </div>
      )}

      {/* Order book */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="card-title mb-0">Today's order book</h6>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={refreshOrders}
              disabled={ordersLoading || !kiteAPI.isReady()}
            >
              {ordersLoading ? 'Refreshing…' : '🔄 Refresh'}
            </button>
          </div>

          {ordersError && <div className="alert alert-danger py-2 small mb-2">{ordersError}</div>}

          {orders.length === 0 ? (
            <p className="text-muted small mb-0">No orders loaded yet — click Refresh.</p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const cancellable = o.status === 'OPEN' || o.status === 'TRIGGER PENDING';
                    return (
                      <tr key={o.order_id}>
                        <td>{o.tradingsymbol}</td>
                        <td>{o.transaction_type} {o.order_type}</td>
                        <td>{o.quantity}</td>
                        <td>{o.price ? `₹${o.price}` : '—'}</td>
                        <td>
                          <span
                            className={`badge ${
                              o.status === 'COMPLETE' ? 'bg-success' :
                              o.status === 'REJECTED' || o.status === 'CANCELLED' ? 'bg-danger' :
                              'bg-secondary'
                            }`}
                            title={o.status_message}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td>
                          {cancellable && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={cancellingId === o.order_id}
                              onClick={() => handleCancelOrder(o.order_id)}
                            >
                              {cancellingId === o.order_id ? '…' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestTradePage;
