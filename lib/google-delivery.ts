export type GoogleDeliveryStatus={campaigns:{id:string;name:string;status:string;live:boolean}[];pending:boolean};
export function googleDeliveryState(c:GoogleDeliveryStatus['campaigns'][number]){
 switch(c.status.toUpperCase()){
  case 'PAUSED':return 'Creada · pausada';
  case 'ENABLED':case 'ACTIVE':return 'Creada · activa';
  case 'REMOVED':case 'DELETED':return 'Retirada';
  case 'DRAFT':return 'Borrador';
  default:return 'Creada · estado por comprobar';
 }
}
