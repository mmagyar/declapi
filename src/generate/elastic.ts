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
export const elastic = (driver: Elastic, input: ElasticInputType):string => {
  const { index } = driver
  const idField = input.idField
  switch (input.method) {
    case 'get': {
      if (input.search === 'textSearch') {
        return `input => elasticGet("${index}", input && input.${idField}, input && input.search)`
      } else if (input.search === 'idOnly') {
        return `input => elasticGet("${index}", input && input.${idField})`
      } else if (input.search === 'full') {
        throw new Error('Parametric get not implemented yet')
      }
      throw new Error(`Unsupported automatic elasticsearch methods: ${JSON.stringify(input.search)}`)
    }
    case 'post': return `input => elasticPost("${index}", input, "${idField}")`
    case 'patch': return `input => elasticPatch("${index}", input, input.${idField})`
    case 'put': return `input => elasticPatch("${index}", input, input.${idField})`
    case 'delete': return `input => elasticDel("${index}", input.${idField})`
  }
}

export default elastic
