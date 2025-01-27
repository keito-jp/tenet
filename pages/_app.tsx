import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import type { ReactElement } from 'react'
import { useEffect } from 'react'
import '../styles/global.css'
import { PageBaseLayout } from '../ui/layouts/PageBaseLayout'
import { Header } from '../ui/header/Header'
import { HeaderState, HeaderStateContext } from '../states/HeaderState'
import { getUser, UserStateContext } from '../states/UserState'
import { init } from '../libs/initFirebase'
import { isValidAuthInstance } from '../libs/isValidAuthInstance'
import { getCookies } from '../libs/cookies'
import jwt from 'jsonwebtoken'

if (process.env['NEXT_PUBLIC_API_MOCKING'] === 'enabled') {
  require('../mocks')
}

export default function App({ Component, pageProps }: AppProps): ReactElement {
  const user = getUser()

  useEffect(() => {
    ;(async () => {
      const { auth } = init()
      if (!isValidAuthInstance(auth) || !auth.currentUser) return
      if (getCookies().has('gqltoken') && getCookies().get('gqltoken') !== '') {
        user.token = getCookies().get('gqltoken') ?? ''
        return
      }
      const localToken = jwt.sign(
        { uid: auth.currentUser.uid },
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        process.env['NEXT_PUBLIC_API_TOKEN_SECRET']!
      )
      document.cookie = `gqltoken=${localToken}`
      user.token = localToken
    })()
  }, [user])

  return (
    <ThemeProvider attribute="class">
      <PageBaseLayout>
        <UserStateContext.Provider value={user}>
          <HeaderStateContext.Provider value={new HeaderState(user)}>
            <Header />
          </HeaderStateContext.Provider>
          <Component {...pageProps} />
        </UserStateContext.Provider>
      </PageBaseLayout>
    </ThemeProvider>
  )
}
