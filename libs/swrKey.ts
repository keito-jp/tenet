import type { apiHooks, client } from './fetchAPI'

const swrKey: Record<string, (args: Record<string, any>) => string> = {
  getActivities: ({personaId}) => `useGetActivities_${personaId}`,
  getBoard: ({topicId, personaId}) => `useGetFollowingBoard_${topicId}_${personaId}`,
  getFollowingBoard: ({ personaId }) => `useGetFollowingBoard_${personaId}`,
  getMe: () => `useGetMe`,
  getPost: ({ id, personaId }) => `useGetPost_${id}_${personaId}`,
  gearch: ({ query }) => `useSearch_${query}`,
} as const

export { swrKey }
