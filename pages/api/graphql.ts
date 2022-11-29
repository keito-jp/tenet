import { ApolloServer } from 'apollo-server-micro'
import Cors from 'micro-cors'
// @ts-expect-error error of graphql-upload package
import processRequest from 'graphql-upload/processRequest.mjs'
import type { MicroRequest } from 'apollo-server-micro/dist/types'
import type { ServerResponse } from 'http'
import schema from '../../server/graphql/nexus'
import { context } from '../../server'
import type { ApolloServerPlugin } from 'apollo-server-plugin-base/src'
import type { GraphQLRequestListener } from 'apollo-server-plugin-base/src'
import { validationSchema } from '../../server/validation/validationSchema'
import { ValidationError } from '../../server/errors/BadRequest/ValidationError'
import { ZodError } from 'zod'

const cors = Cors()

const validationPlugin: ApolloServerPlugin = {
  async requestDidStart(): Promise<GraphQLRequestListener> {
    return {
      async didResolveOperation({ operationName, operation, request }) {
        if (!operation || !operationName || !request.variables) {
          return
        }
        try {
          validationSchema[operationName as unknown as keyof typeof validationSchema]!.parse(
            request.variables as never
          )
        } catch (e) {
          if (e instanceof ZodError) {
            // same format as ZodError thrown in resolver
            throw new ValidationError(e.message, { exception: e })
          } else {
            throw new Error(`No validator found for ${operationName} endpoint.`)
          }
        }
        return
      },
    }
  },
}

const apolloServer = new ApolloServer({ schema, context, plugins: [validationPlugin] })

const startServer = apolloServer.start()

const handler = async (req: MicroRequest, res: ServerResponse): Promise<void> => {
  if (req.method === 'OPTIONS') {
    res.end()
    return Promise.resolve()
  }
  await startServer
  const contentType = req.headers['content-type']
  if (contentType && contentType.startsWith('multipart/form-data')) {
    req.filePayload = await processRequest(req, res)
  }

  return await apolloServer.createHandler({
    path: '/api/graphql',
  })(req, res)
}

const handlerWithCors = cors(handler)

export const config = {
  api: {
    bodyParser: false,
  },
}

export default handlerWithCors
