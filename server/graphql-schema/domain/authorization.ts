import type { AllowedWritingRole, Persona, Post, PrismaClient, User } from '@prisma/client'
import type {
  Persona as PrismaPersona,
  Post as PrismaPost,
  Reply as PrismaReply,
  Thread as PrismaThread,
} from '@prisma/client'
import {
  defaultNotAuthenticatedErrorMessage,
  NotAuthenticatedError,
} from '../../errors/NotAuthenticatedError'
import { NotFoundError } from '../../errors/NotFoundError'
import { NotAuthorizedError } from '../../errors/NotAuthorizedError'
import type { Privilege } from '../../generated-files/frontend-graphql-definition'

const validatePersona = async (
  user: User | null,
  personaId: number,
  prisma: PrismaClient
): Promise<Persona> => {
  if (!user) {
    throw new NotAuthenticatedError(defaultNotAuthenticatedErrorMessage)
  }
  const currentPersona = await prisma.persona.findFirst({
    where: {
      user: {
        id: user.id,
      },
      id: personaId,
    },
  })
  if (!currentPersona) {
    throw new NotFoundError('Invalid persona id')
  }
  if (currentPersona.userId !== user.id) {
    throw new NotAuthorizedError('Persona is not owned by current user.')
  }
  return currentPersona
}

const canDeletePost = async (
  persona: Persona,
  post: Post & {
    board: { moderators: Persona[]; defaultPostRole: AllowedWritingRole }
    persona: Persona
    defaultPostRole: AllowedWritingRole
  }
): Promise<boolean> => {
  if (post.board.defaultPostRole.delete === true) {
    return true
  }
  if (post.defaultPostRole.delete === true) {
    return true
  }
  if (post.board.moderators.some((moderatorPersona) => moderatorPersona.id === persona.id)) {
    return true
  }
  return post.persona.id === persona.id
}

const postWithPrivilege = (
  post: PrismaPost & {
    persona: PrismaPersona
    threads: (PrismaThread & {
      persona: PrismaPersona
      replies: (PrismaReply & { persona: PrismaPersona })[]
    })[]
  },
  defaultPrivilege: Privilege,
  persona?: PrismaPersona
): PrismaPost & {
  persona: PrismaPersona
  privilege: Privilege
  threads: (PrismaThread & {
    persona: PrismaPersona
    privilege: Privilege
    replies: (PrismaReply & {
      privilege: Privilege
      persona: PrismaPersona
    })[]
  })[]
} => {
  if (persona) {
    return {
      ...post,
      threads: post.threads.map((thread) => ({
        ...thread,
        privilege: { ...defaultPrivilege, deleteSelf: thread.personaId === persona.id },
        replies: thread.replies.map((reply) => ({
          ...reply,
          privilege: { ...defaultPrivilege, deleteSelf: reply.personaId === persona.id },
        })),
      })),
      privilege: {
        ...defaultPrivilege,
        deleteSelf: post.persona.id === persona.id,
      },
    }
  } else {
    return {
      ...post,
      threads: post.threads.map((thread) => ({
        ...thread,
        privilege: { ...defaultPrivilege },
        replies: thread.replies.map((reply) => ({
          ...reply,
          privilege: { ...defaultPrivilege },
        })),
      })),
      privilege: defaultPrivilege,
    }
  }
}

export { validatePersona, canDeletePost, postWithPrivilege }