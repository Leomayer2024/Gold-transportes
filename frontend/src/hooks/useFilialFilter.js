import { useEffect, useState } from 'react'

/**
 * Manages filial selection state.
 * Auto-selects the only option when the accessible filial list has exactly one entry,
 * and suppresses the "Todas" option in that case.
 */
export function useFilialFilter(filiais, idKey = 'id') {
  const [selectedFilial, setSelectedFilial] = useState('')

  useEffect(() => {
    if (filiais?.length === 1 && !selectedFilial) {
      setSelectedFilial(String(filiais[0][idKey]))
    }
  }, [filiais])

  const showAllOption = (filiais?.length ?? 0) !== 1

  return { selectedFilial, setSelectedFilial, showAllOption }
}
