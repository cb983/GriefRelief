namespace lmco.com.grief.app;

entity GriefIssue {
  key ID: UUID;
  purchaseOrderNumber: String(20);
  partNumber: String(20);
  issueDescription: String(1000);
  dateReported: Date;
  status: String(20);
  priority: String(10);
  assignedTo: String(50);
  resolution: String(1000);
  resolutionDate: Date;
}