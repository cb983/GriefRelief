using GriefReliefService as service from '../../srv/service';
annotate service.GriefIssue with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'purchaseOrderNumber',
                Value : purchaseOrderNumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'partNumber',
                Value : partNumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'issueDescription',
                Value : issueDescription,
            },
            {
                $Type : 'UI.DataField',
                Label : 'dateReported',
                Value : dateReported,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'priority',
                Value : priority,
            },
            {
                $Type : 'UI.DataField',
                Label : 'assignedTo',
                Value : assignedTo,
            },
            {
                $Type : 'UI.DataField',
                Label : 'resolution',
                Value : resolution,
            },
            {
                $Type : 'UI.DataField',
                Label : 'resolutionDate',
                Value : resolutionDate,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'purchaseOrderNumber',
            Value : purchaseOrderNumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'partNumber',
            Value : partNumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'issueDescription',
            Value : issueDescription,
        },
        {
            $Type : 'UI.DataField',
            Label : 'dateReported',
            Value : dateReported,
        },
        {
            $Type : 'UI.DataField',
            Label : 'status',
            Value : status,
        },
    ],
);

