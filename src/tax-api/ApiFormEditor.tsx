import { asObject } from './payload'
import { emptyValue, type Schema } from './schema'
export function ApiFormEditor({schema,value,onChange,path='api'}:{schema:Schema;value:unknown;onChange:(value:unknown)=>void;path?:string}){
  if(schema.kind==='object'){
    const object=asObject(value)
    const set=(key:string,next:unknown)=>onChange({...object,[key]:next})
    const wrapper='isExist' in schema.fields
    return <details className="tax-api-group" open={path==='api'||wrapper&&object.isExist===true}><summary>{schema.label}{wrapper?object.isExist===true?' · קיים':object.isExist===false?' · אין':' · טרם נבדק':''}</summary><div>
      {wrapper?<><label className="tax-api-field">האם קיים?<select aria-label={`${schema.label} — קיום ${path}`} value={object.isExist===true?'yes':object.isExist===false?'no':''} onChange={event=>{const next=event.target.value;if(next==='no'&&Array.isArray(object.dataList)&&object.dataList.length&&!window.confirm('סימון אין ימחק את פריטי הסעיף מטיוטת השידור בלבד. להמשיך?'))return;onChange({...object,isExist:next==='yes'?true:next==='no'?false:null,...(next==='no'?{dataList:[]}: {})})}}><option value="">טרם נבדק</option><option value="yes">קיים</option><option value="no">אין</option></select></label>{object.isExist===true&&<ApiFormEditor schema={schema.fields.dataList} value={object.dataList} onChange={next=>set('dataList',next)} path={`${path}.dataList`}/>}</>:
        Object.entries(schema.fields).map(([key,node])=><ApiFormEditor key={key} schema={node} value={object[key]} onChange={next=>set(key,next)} path={`${path}.${key}`}/>)}
    </div></details>
  }
  if(schema.kind==='list'){
    const items=Array.isArray(value)?value:[]
    return <div className="tax-api-list">{items.map((item,index)=><div key={index}><ApiFormEditor schema={schema.item} value={item} path={`${path}[${index}]`} onChange={next=>onChange(items.map((old,i)=>i===index?next:old))}/><button className="cp-text-btn" onClick={()=>{if(window.confirm('להסיר את הפריט מטיוטת השידור?'))onChange(items.filter((_,i)=>i!==index))}}>הסרת פריט</button></div>)}<button className="cp-btn cp-btn-white" onClick={()=>onChange([...items,emptyValue(schema.item)])}>הוספת פריט — {schema.label}</button></div>
  }
  return <label className="tax-api-field">{schema.label}{schema.kind==='boolean'?<select aria-label={`${schema.label} ${path}`} value={value===true?'yes':value===false?'no':''} onChange={event=>onChange(event.target.value==='yes'?true:event.target.value==='no'?false:null)}><option value="">טרם נבדק</option><option value="yes">כן — מאשר/ת</option><option value="no">לא</option></select>:schema.codes?<select aria-label={`${schema.label} ${path}`} value={typeof value==='number'?value:''} onChange={event=>onChange(event.target.value===''?'':Number(event.target.value))}><option value="">בחרי קוד</option>{schema.codes.map(code=><option value={code} key={code}>{code===-99?'אחר (‎-99)':code}</option>)}</select>:<input aria-label={`${schema.label} ${path}`} type={schema.kind==='date'?'date':schema.kind==='number'?'number':'text'} step={schema.kind==='number'&&schema.decimal?'0.01':'1'} value={schema.kind==='date'?typeof value==='string'?value.slice(0,10):'':typeof value==='string'||typeof value==='number'?value:''} onChange={event=>onChange(schema.kind==='date'?event.target.value?`${event.target.value}T00:00:00Z`:'':schema.kind==='number'?event.target.value===''?'':Number(event.target.value):event.target.value)} maxLength={schema.kind==='string'?schema.max:undefined}/>}</label>
}
