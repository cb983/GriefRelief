sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"griefreliefagent/test/integration/pages/GriefIssueList",
	"griefreliefagent/test/integration/pages/GriefIssueObjectPage"
], function (JourneyRunner, GriefIssueList, GriefIssueObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('griefreliefagent') + '/test/flp.html#app-preview',
        pages: {
			onTheGriefIssueList: GriefIssueList,
			onTheGriefIssueObjectPage: GriefIssueObjectPage
        },
        async: true
    });

    return runner;
});

