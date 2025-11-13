using { lmco.com.grief.app as my } from '../db/schema.cds';

@path : '/service/GriefReliefService'
service GriefReliefService
{
    entity GRIEF_RECORD as projection on my.GRIEF_RECORD{*} actions { 
        action submit(); 
    }
    entity MAINTENANCE_ORDER as projection on my.MAINTENANCE_ORDER{*}
    entity CUST_MAT_INFO as projection on my.CUST_MAT_INFO{*}
    entity MATERIAL_MASTER as projection on my.MATERIAL_MASTER{*}
    entity INBOUND_DELIVERY as projection on my.INBOUND_DELIVERY{*}
    entity PO_DATA as projection on my.PO_DATA{*}
}

annotate GriefReliefService with @requires :
[
    'authenticated-user'
];
