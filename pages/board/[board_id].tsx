import { Header } from '../../ui/header/Header'
import { HeaderState, HeaderStateContext } from '../../states/HeaderState'
import React, { useEffect, useState } from 'react'
import { getUser, UserStateContext } from '../../states/UserState'
import type { PostType } from '../../states/PostState'
import { BoardState, BoardStateContext, PostState } from '../../states/PostState'
import { PageContentLayout } from '../../ui/layouts/PageContentLayout'
import { useRouter } from 'next/router'
import { Board } from '../../ui/board/Board'
import { PostFormState, PostFormStateContext } from '../../states/PostFormState'
import { makePusher } from '../../libs/usePusher'
import type { Channel } from 'pusher-js'
import type { GetServerSideProps, NextPage } from 'next'
import { fetcher, useTenet } from '../../libs/getClient'
import { getGqlToken } from '../../libs/cookies'

type Board = {
  id: string
  title: string
  description: string
  posts: PostType[]
}

type FollowingBoard = {
  board: Board
  boardId: string
  createdAt: string
  id: string
}

type BoardPageProps = { initialBoardData: Record<string, never> }

const BoardPage: NextPage<BoardPageProps> = ({ initialBoardData }) => {
  const router = useRouter()
  const {
    isReady,
    query: { board_id: rawBoardId },
  } = router
  const user = getUser()
  const [personaId, setPersonaId] = useState<string>()

  const [context] = useState(new BoardState({}))
  const boardId = isReady && typeof rawBoardId === 'string' ? rawBoardId : ''

  const { data: boardData } = useTenet<'getBoard', { board: Board }>({
    operationName: 'getBoard',
    variables: personaId
      ? {
          topicId: boardId,
          personaId,
        }
      : { topicId: boardId },
    fallbackData: initialBoardData,
  })
  context.id = boardData?.board.id ?? null
  context.title = boardData?.board.title ?? null
  context.description = boardData?.board.description ?? null
  context.posts = boardData?.board.posts.map((v: PostType) => PostState.fromPostTypeJSON(v)) ?? []

  const { data: followingBoardData, mutate: mutateFollowingBoard } = useTenet<
    'getFollowingBoard',
    {
      getFollowingBoard: FollowingBoard[]
    }
  >({
    operationName: 'getFollowingBoard',
    variables: { personaId: personaId ?? String(0) },
    token: getGqlToken(),
  })

  useEffect(() => {
    const f = async (): Promise<void> => {
      if (user.token !== 'INVALID_TOKEN' && !user.requested) {
        await user.request()
        if (user.personas.length < 1) {
          await router.push('/persona/onboarding')
        }
        if (user.currentPersona?.id) {
          setPersonaId(user.currentPersona.id)
        }
      }

      const pusher = await makePusher()
      const postIds = boardData?.board.posts.map((post: PostType) => post.id) ?? []

      const postChannels: Channel[] = []

      postIds.forEach((postId: string) => {
        if (user?.notifications.every((notification) => notification.channel !== postId)) {
          postChannels.push(pusher.subscribe(postId))
        }
      })

      postChannels.forEach((channel) =>
        user?.subscribeNotifications(channel, 'typing', () => {
          /* no-op */
        })
      )
    }
    f()
  })

  const following = followingBoardData?.getFollowingBoard.some(
    (boardData: FollowingBoard) => boardId && boardData.board.id === boardId
  )

  const onFollowButtonClick = async (): Promise<void> => {
    if (!following) {
      await fetcher({
        operationName: 'createFollowingBoard',
        variables: {
          personaId: personaId ?? 0,
          boardId,
        },
        token: getGqlToken(),
      })
      await mutateFollowingBoard()
    } else {
      await fetcher({
        operationName: 'unfollowBoard',
        variables: {
          personaId: personaId ?? 0,
          boardId,
        },
        token: getGqlToken(),
      })
      await mutateFollowingBoard()
    }
  }

  const boardProps = boardId
    ? {
        followButtonType: (following ? 'unfollow' : 'follow') as 'unfollow' | 'follow',
        onFollowButtonClick,
      }
    : {}

  return (
    <UserStateContext.Provider value={user}>
      <HeaderStateContext.Provider value={new HeaderState(user)}>
        <Header />
      </HeaderStateContext.Provider>
      <PageContentLayout
        main={
          <PostFormStateContext.Provider value={new PostFormState({ boardState: context })}>
            <BoardStateContext.Provider value={context}>
              <Board {...boardProps} />
            </BoardStateContext.Provider>
          </PostFormStateContext.Provider>
        }
        side={<div className="max-w-xs">test</div>}
      />
    </UserStateContext.Provider>
  )
}

type BoardPageParams = {
  board_id: string
}

export const getServerSideProps: GetServerSideProps<BoardPageProps, BoardPageParams> = async (
  context
) => {
  const { params } = context
  if (!params) throw new Error('params of board page is undefined')
  const { board_id } = params

  const initialBoardData: Record<string, never> = await fetcher({
    operationName: 'getBoard',
    variables: { topicId: board_id },
  })

  return {
    props: {
      initialBoardData,
    },
  }
}

export default BoardPage
