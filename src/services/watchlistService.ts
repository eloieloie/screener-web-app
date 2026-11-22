import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore'
import { db, auth } from '../config/firebase'

const WATCHLISTS_COLLECTION = 'watchlists'

export interface Watchlist {
  id: string
  name: string
  stockIds: string[]
}

const requireUid = (): string => {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be logged in to use watchlists')
  return uid
}

// Real-time subscription to the signed-in user's watchlists (sorted by name).
export const subscribeToWatchlists = (callback: (lists: Watchlist[]) => void): (() => void) => {
  const uid = auth.currentUser?.uid
  if (!uid) {
    callback([])
    return () => {}
  }
  const q = query(collection(db, WATCHLISTS_COLLECTION), where('userId', '==', uid))
  return onSnapshot(
    q,
    snapshot => {
      const lists = snapshot.docs.map(d => {
        const data = d.data()
        return { id: d.id, name: data.name as string, stockIds: (data.stockIds as string[]) || [] }
      })
      lists.sort((a, b) => a.name.localeCompare(b.name))
      callback(lists)
    },
    error => console.error('Error in watchlists subscription:', error)
  )
}

export const createWatchlist = async (name: string, stockIds: string[] = []): Promise<string> => {
  const ref = await addDoc(collection(db, WATCHLISTS_COLLECTION), {
    userId: requireUid(),
    name: name.trim(),
    stockIds,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  return ref.id
}

export const addStockToWatchlist = (watchlistId: string, stockId: string): Promise<void> =>
  updateDoc(doc(db, WATCHLISTS_COLLECTION, watchlistId), {
    stockIds: arrayUnion(stockId),
    updatedAt: Timestamp.now()
  })

export const removeStockFromWatchlist = (watchlistId: string, stockId: string): Promise<void> =>
  updateDoc(doc(db, WATCHLISTS_COLLECTION, watchlistId), {
    stockIds: arrayRemove(stockId),
    updatedAt: Timestamp.now()
  })

export const deleteWatchlist = (watchlistId: string): Promise<void> =>
  deleteDoc(doc(db, WATCHLISTS_COLLECTION, watchlistId))
