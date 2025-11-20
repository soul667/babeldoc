import { useEffect, useState } from 'react'
import Translate from './Translate'
import TextTranslate from './TextTranslate'
import WolaiBookmarks from './WolaiBookmarks'

export default function App() {
  const [enterAction, setEnterAction] = useState({})
  const [route, setRoute] = useState('')

  useEffect(() => {
    window.utools.onPluginEnter((action) => {
      setRoute(action.code)
      setEnterAction(action)
    })
    window.utools.onPluginOut((isKill) => {
      setRoute('')
    })
  }, [])

  if (route === 'translate') {
    return <Translate enterAction={enterAction} />
  }

  if (route === 'text-translate') {
    return <TextTranslate enterAction={enterAction} />
  }

  if (route === 'wolai-bookmarks') {
    return <WolaiBookmarks enterAction={enterAction} />
  }

  return false
}
