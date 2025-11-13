using { lmco.com.grief.app as my } from '../db/schema.cds';

@path : '/service/GriefReliefService'
service GriefReliefService
{
    entity GriefIssue as projection on my.GriefIssue{*}
}

annotate GriefReliefService with @requires :
[
    'authenticated-user'
];
