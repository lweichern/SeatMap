import { allocate, type AllocationInput } from '@/lib/allocate'

// Allocation runs off the main thread so the planner UI never janks and
// re-runs are instant. 300 guests take ~100ms; the worker is future-proofing.
self.onmessage = (e: MessageEvent<AllocationInput>) => {
  self.postMessage(allocate(e.data))
}
