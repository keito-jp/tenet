import { Header } from '../../ui/header/Header'
import { HeaderState, HeaderStateContext } from '../../states/HeaderState'
import React, { useEffect, useState } from 'react'
import { defaultUser, UserState, UserStateContext } from '../../states/UserState'
import type { BoardType } from '../../states/PostState'
import { BoardState, BoardStateContext, PostState } from '../../states/PostState'
import { getGqlToken } from '../../libs/cookies'
import { PageContentLayout } from '../../ui/layouts/PageContentLayout'
import { useRouter } from 'next/router'
import { Board } from '../../ui/board/Board'
import { fetcher } from '../../libs/fetchAPI'
import useSWR from 'swr'
import { PageBaseLayout } from '../../ui/layouts/PageBaseLayout'
import { queryDocuments } from '../../server/graphql-schema/queryDocuments'
import { PostFormState, PostFormStateContext } from '../../states/PostFormState'
import { makePusher } from '../../libs/usePusher'

const IndexPage: React.FC = () => {
  const token = getGqlToken()
  const router = useRouter()
  const {
    isReady,
    query: { board_id },
  } = router
  let user = defaultUser()
  if (token) user = new UserState(token, [], 0)

  const contentGraphqlQueryDocument = queryDocuments.Query.board

  const [context, setContext] = useState<BoardState>(
    new BoardState('', contentGraphqlQueryDocument)
  )

  useEffect(() => {
    const f = async (): Promise<void> => {
      if (user) {
        await user.request()
      }

      const pusher = await makePusher()
      const channel = pusher.subscribe('post')
      channel.bind(
        'typing',
        function (data: { postId: string; createdAt: string; authorPersonaId: number }) {
          console.log(JSON.stringify(data))
        }
      )
    }
    f()
  }, [token, router, user])

  const { data, mutate } = useSWR<{ board: BoardType }>(
    () => (isReady ? contentGraphqlQueryDocument : null),
    (document) => fetcher(document, { topicId: board_id }, token)
  )

  useEffect(() => {
    mutate()
  }, [])

  useEffect(() => {
    if (data) {
      setContext(
        new BoardState(data.board.id, contentGraphqlQueryDocument, {
          title: data.board.title,
          description: data.board.description,
          posts: data.board.posts.map((v) => PostState.fromPostTypeJSON(v)),
        })
      )
    }
  }, [token, data, contentGraphqlQueryDocument])
  const main: React.FC = () => (
    <>
      <BoardStateContext.Provider value={context}>
        <Board />
      </BoardStateContext.Provider>
    </>
  )
  return (
    <PageBaseLayout>
      <UserStateContext.Provider value={user}>
        <PostFormStateContext.Provider value={new PostFormState({})}>
          <HeaderStateContext.Provider value={new HeaderState(user)}>
            <Header />
          </HeaderStateContext.Provider>
          <PageContentLayout Main={main} Side={() => <div className="max-w-xs">test</div>} />
        </PostFormStateContext.Provider>
      </UserStateContext.Provider>
    </PageBaseLayout>
  )
}

export default IndexPage
