import { useEffect, useRef, useState } from "react"

export interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/** Runs `fn` whenever `deps` change; ignores results from a stale run. */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true })
  const generation = useRef(0)

  useEffect(() => {
    const mine = ++generation.current
    setState((s) => ({ data: s.data, error: null, loading: true }))
    fn()
      .then((data) => {
        if (generation.current === mine) setState({ data, error: null, loading: false })
      })
      .catch((err: unknown) => {
        if (generation.current === mine) {
          setState({ data: null, error: err instanceof Error ? err.message : String(err), loading: false })
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
