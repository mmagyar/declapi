import { Elastic } from '../DataDriverTypes'
import { SearchTypes, HttpMethods } from '../globalTypes'
export type ElasticInputGet = {
  method: 'get',
  search: SearchTypes
}
export type ElasticInputBase = {idField:string, method: HttpMethods, search? :SearchTypes}
export type ElasticInputType = ElasticInputBase & (ElasticInputGet | {
  method: 'post' | 'put' | 'patch' | 'delete',
})
export const elasticCodeGen = (driver: Elastic, input: ElasticInputType):string => {
  const { index } = driver
  const idField = input.idField
  switch (input.method) {
    case 'get': {
      if (input.search === 'textSearch') {
        return `(input, auth) => elastic.get("${index}", auth, input && input.${idField}, input && input.search)`
      } else if (input.search === 'idOnly') {
        return `(input, auth) => elastic.get("${index}", auth, input && input.${idField})`
      } else if (input.search === 'full') {
        throw new Error('Parametric get not implemented yet')
      }
      throw new Error(`Unsupported automatic elasticsearch methods: ${JSON.stringify(input.search)}`)
    }
    case 'post': return `(input, auth) => elastic.post("${index}", auth, input, "${idField}")`
    case 'patch': return `(input, auth) => elastic.patch("${index}", auth, input, input.${idField})`
    case 'put': return `(input, auth) => elastic.patch("${index}", auth, input, input.${idField})`
    case 'delete': return `(input, auth) => elastic.del("${index}", auth, input.${idField})`
  }
}

export default elasticCodeGen
