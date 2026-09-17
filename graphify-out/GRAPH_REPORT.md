# Graph Report - q4s-dashboard  (2026-09-14)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4183 nodes · 15181 edges · 168 communities (154 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4c85b066`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162

## God Nodes (most connected - your core abstractions)
1. `lucide-react` - 299 edges
2. `buttonVariants()` - 292 edges
3. `cn()` - 261 edges
4. `db` - 261 edges
5. `formatDate()` - 170 edges
6. `Card()` - 164 edges
7. `round2()` - 151 edges
8. `CardContent()` - 146 edges
9. `react` - 145 edges
10. `formatCurrency()` - 142 edges

## Surprising Connections (you probably didn't know these)
- `regelTotaal()` --calls--> `round2()`  [EXTRACTED]
  tests/toeslag.test.ts → src/lib/utils.ts
- `gate()` --calls--> `evaluateTimesheetGate()`  [EXTRACTED]
  tests/timesheet-auto-gate.test.ts → src/lib/timesheet-auto-gate.ts
- `dubbel()` --calls--> `detectDuplicates()`  [EXTRACTED]
  tests/facturatie-detecties.test.ts → src/lib/facturatie-detecties.ts
- `marge()` --calls--> `evaluateMargin()`  [EXTRACTED]
  tests/facturatie-detecties.test.ts → src/lib/facturatie-detecties.ts
- `match()` --calls--> `matchFactuurBedrag()`  [EXTRACTED]
  tests/week-wizard.test.ts → src/lib/week-wizard.ts

## Import Cycles
- None detected.

## Communities (168 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (68): metadata, createCandidateLinkedOutreach(), BerichtenPage(), metadata, dynamic, metadata, ConnectorsPage(), metadata (+60 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (41): @prisma/client, Opt, VacancyOption, PRIORITIES, IdName, IdName, StageOption, ACCENTS (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (69): deleteDeal(), deleteNote(), togglePinNote(), CloseDealButtons(), DealDetailPage(), dynamic, metadata, Stars() (+61 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (59): dynamic, HIDE, metadata, addKnownConnector(), ConnectorForm(), metadata, CopyButton(), copyText() (+51 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (54): dynamic, ENTITY_LABELS, metadata, SP, CompanyContactsPage(), dynamic, metadata, BAR (+46 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (58): recharts, dynamic, metadata, Notice(), SP, DashboardChart(), DashboardLine(), DashboardPie() (+50 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (28): lucide-react, react, react-dom, TIMES, Pending, leeg, PipelineButton(), PipelineClient (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (49): AfwezigheidPage(), dynamic, fullName(), metadata, EventForm(), toLocalInput(), AfspraakDetailPage(), metadata (+41 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (57): clearAiKey(), PROVIDERS, revalidate(), saveAiConfig(), saveAiKey(), testAiConnection(), ApiSleutelsPage(), TestConnectionButton() (+49 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (57): uploadCv(), dataToRecord(), deleteCvProfile(), jsonList(), reviewSchema, saveCvProfile(), startCvProfile(), geminiJSONText() (+49 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (50): coerceAvailability(), coerceDiscipline(), isAllowedCv(), OPTIONS(), pick(), POST(), runtime, disciplineLabel() (+42 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (54): generateTalentpoolPost(), SITE_URL, activeTextProvider(), activeTextProviderFast(), AI_MODEL, AI_MODEL_FAST, aiJSON(), aiJSONFromFile() (+46 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (45): avgOf(), EvaluatiesDashboardPage(), nl1(), createEvaluation(), createOverigConsultant(), deleteEvaluation(), EvaluationInput, EvaluationSchema (+37 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (45): dynamic, POST(), AnalysesPage(), MarktkansenPage(), runSyncNow(), SourcingPage(), backTo(), createVacancy() (+37 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (47): AkkoordPlaatsing, beschrijfBestaandeUrenstaat(), CONFIRM_FOUT, dubbeleWeekstaten(), hergebruikBestaandeUrenstaat(), HergebruikUitkomst, leesBestand(), leesTimesheet() (+39 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (39): PersoonKaart(), PersoonPicker(), WeekWizard(), WizardPersoon, WizardTimesheet, WizardWeekkeuze, GereedPerPlaatsing, WeekSlot (+31 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (41): DateInput(), commit(), commitText(), onTimeChange(), pickDay(), serialize(), displayLabel(), dm (+33 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (40): dynamic, GET(), DraftBody, DraftLine, num(), POST(), toDate(), Outcome (+32 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (41): ApproveInboxButton(), confirmFields(), toDateInput(), verwijderScan(), CONF_LABEL, DAG_LABELS, dynamic, FlagList() (+33 more)

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (25): metadata, loadOptions(), metadata, NieuweAfspraakPage(), metadata, FactuurBewerkenPage(), metadata, toInput() (+17 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (35): saveCvTemplate(), CvTemplatePage(), dynamic, metadata, VOORBEELD, GET(), CvProfileReviewPage(), metadata (+27 more)

### Community 21 - "Community 21"
Cohesion: 0.06
Nodes (38): BetaalmatchingPage(), partyName(), RecruitmentKpiPage(), CloudPage(), dynamic, metadata, PROVIDER_META, STATUS_META (+30 more)

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (40): addCertificate(), dateOrNull(), deleteCertificate(), deleteCertificateFile(), extractCertificateFile(), fileFields(), toggleAiExtract(), updateCertificate() (+32 more)

### Community 23 - "Community 23"
Cohesion: 0.09
Nodes (37): extractInbox(), DagCel(), PeekDay, TimesheetPeek(), GeleerdNote(), excelToText(), isSpreadsheet(), bekendePlaatsing() (+29 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (40): @aws-sdk/client-s3, CloudSettingsSchema, syncExistingData(), push(), extractExpense(), Receipt, RECEIPT_SCHEMA, runExpenseExtraction() (+32 more)

### Community 25 - "Community 25"
Cohesion: 0.08
Nodes (38): SettingsForm(), CrmInstellingenLayout(), metadata, dynamic, PersoonlijkTab(), generateWeakPointsAnalysis(), AiAnalysis(), run() (+30 more)

### Community 26 - "Community 26"
Cohesion: 0.07
Nodes (38): Betaalmatching, BETAALMATCHING_LABELS, BetaalmatchingLabels, BetaalmatchingSamenvatting, BucketTotaal, buildBetaalmatching(), byName(), compact() (+30 more)

### Community 27 - "Community 27"
Cohesion: 0.09
Nodes (36): UrenstaatDetailPage(), buildSurchargeRows(), buildTimesheetLines(), BuiltLine, computeSide(), computeTimesheetMoney(), GEEN_TOESLAG, hoursOn() (+28 more)

### Community 28 - "Community 28"
Cohesion: 0.10
Nodes (34): getypteWeekVanStaat(), leesFactuur(), dynamic, metadata, WeekVerwerkenPage(), LEGENDA, STIJL, WeekStrip() (+26 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (30): BetalingenPage(), metadata, BoekhoudingPage(), quarterOf(), ContactDetailPage(), DeclaratiesPage(), bulkMelding(), FacturenPage() (+22 more)

### Community 30 - "Community 30"
Cohesion: 0.07
Nodes (31): CertPeopleList(), CertPerson, CertificeringenPage(), CertItem, dynamic, Folder, metadata, ORDER (+23 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (36): addContactNote(), addDealNote(), assignCandidateToDeal(), AssignSchema, closeDeal(), completeDealFollowUp(), createDeal(), createDealFromCandidate() (+28 more)

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (22): GET(), GET(), GET(), NOTE: no auth yet — add an auth check here once authentication is in place., GET(), GET(), GET(), GET() (+14 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (30): @napi-rs/canvas, pdf-lib, orientationRotation(), pdfAutoRotateEnabled(), shouldRasterizePdf(), uprightRender(), visionFile(), assetDir() (+22 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (30): AfwijkingMail, afwijkingMailVoorbeeld(), bedragExBtw(), weekVan(), detectDuplicates(), DuplicateInput, DuplicateResult, evaluateMargin() (+22 more)

### Community 35 - "Community 35"
Cohesion: 0.10
Nodes (32): APPLICATION_IDLE_DAYS, ApplicationFunnel, ApplicationKpiInput, applications(), average(), BottleneckStage, buildApplicationFunnel(), buildRecruitmentKpis() (+24 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (31): POST(), back(), connectApi(), countFailed(), markAlertRead(), markAllAlertsRead(), pullNow(), revalidate() (+23 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (24): dynamic, metadata, dynamic, effectiveStatus(), FacturatieDashboardPage(), metadata, monthFmt, dynamic (+16 more)

### Community 38 - "Community 38"
Cohesion: 0.11
Nodes (32): CharCounter(), LinkedInGenerator(), applyVacancy(), onVacInput(), parseRaw(), pickVacancy(), autoBold(), boldize() (+24 more)

### Community 39 - "Community 39"
Cohesion: 0.11
Nodes (28): weekShort(), dateContext(), EXTRACT_SCHEMA, extractReceivedInvoiceFromFile(), fail(), InvoiceCandidate, InvoiceExtracted, InvoiceExtractFailure (+20 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (20): CertFileButton(), dynamic, metadata, ORDER, generateMetadata(), MedewerkerNotitiesPage(), PlaatsingNotitiesPage(), CertBadge() (+12 more)

### Community 41 - "Community 41"
Cohesion: 0.09
Nodes (26): addBonus(), addPayslip(), addWorklog(), createEmployee(), deleteBonus(), deleteLeave(), deletePayslip(), deleteWorklog() (+18 more)

### Community 42 - "Community 42"
Cohesion: 0.10
Nodes (26): bewaarConcept(), Stepper(), WizardRonde(), autoLeesFactuur(), autoLeesTimesheet(), corrigeer(), ga(), planConcept() (+18 more)

### Community 43 - "Community 43"
Cohesion: 0.11
Nodes (27): fflate, isTimesheetFile(), POST(), NOTE: add real signature verification per provider before production., uploadInboxTimesheet(), aiExtractCvFields(), CV_EXTENSIONS, CV_EXTRACT_SCHEMA (+19 more)

### Community 44 - "Community 44"
Cohesion: 0.13
Nodes (26): CalDeadline, CalEvent, CalTask, DagPage(), dynamic, hhmm(), iso(), metadata (+18 more)

### Community 45 - "Community 45"
Cohesion: 0.09
Nodes (23): GearchiveerdItemPage(), renderValue(), ArchiefPage(), entLabel(), PostDetailPage(), VakproefPage(), deleteApplication(), reopenApplication() (+15 more)

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (22): approveOutreach(), createOutreach(), deleteOutreach(), draftOutreach(), markSent(), OutreachSchema, reopenOutreach(), toData() (+14 more)

### Community 47 - "Community 47"
Cohesion: 0.12
Nodes (25): confirmInbox(), isUitgelezen(), bevestigdeDagUren(), ConfirmInboxError, confirmInboxItem(), ConfirmInboxItemInput, ConfirmInboxItemResult, ConfirmInboxFields (+17 more)

### Community 48 - "Community 48"
Cohesion: 0.11
Nodes (20): deleteCandidate(), CvUploadForm(), CvTab(), fileSize(), getCandidate, getCompanySuggestions, getDossierCounts, getMatches (+12 more)

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (25): subtitle(), UrencontrolePage(), GATE_HISTORY_WEEKS, RecentWeeksSummary, summarizeRecentWeeks(), usableHours(), WeeklyTotal, EMPTY_TOTALS (+17 more)

### Community 50 - "Community 50"
Cohesion: 0.08
Nodes (26): archiveEvaluationToDossier(), GET(), InstellingenPage(), metadata, SettingsForm(), VacancyOption, dynamic, metadata (+18 more)

### Community 51 - "Community 51"
Cohesion: 0.09
Nodes (16): AddStageForm(), dynamic, metadata, NieuweInkoopfactuurPage(), toInput(), PurchaseInvoiceForm(), PurchaseLineOption, ContactItem() (+8 more)

### Community 52 - "Community 52"
Cohesion: 0.07
Nodes (27): name, prisma, seed, private, version, @anthropic-ai/sdk, clsx, date-fns (+19 more)

### Community 53 - "Community 53"
Cohesion: 0.13
Nodes (22): createTask(), deleteTask(), reassignTask(), revalidate(), safeInternalPath(), toggleTask(), validEmployeeId(), AssigneeSelect() (+14 more)

### Community 54 - "Community 54"
Cohesion: 0.14
Nodes (24): InboxPage(), personName(), remindAllMissing(), remindOne(), TimesheetStatusPage(), dynamic, metadata, toInput() (+16 more)

### Community 55 - "Community 55"
Cohesion: 0.11
Nodes (25): abonneerOpVerbergen(), AskAi(), ask(), AVAIL_DOT, leesVerborgen(), Msg, SUGGESTIONS, askAssistant() (+17 more)

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (21): createUser(), deleteUser(), updateUser(), UserSchema, dynamic, GebruikerBewerkenPage(), metadata, confirmPasswordCode() (+13 more)

### Community 57 - "Community 57"
Cohesion: 0.09
Nodes (22): BillingSchema, collectPersonDocs(), coreToData(), createPlacement(), deletePlacementDraft(), DocMetaResult, NewPersonSchema, PlacementCoreSchema (+14 more)

### Community 58 - "Community 58"
Cohesion: 0.14
Nodes (21): assertDestructiveAllowed(), hostOf(), LOCAL_HOSTS, addDays(), DEFAULT_STAGES, hashPassword(), RECRUITERS, seedCrm() (+13 more)

### Community 59 - "Community 59"
Cohesion: 0.08
Nodes (25): ALERT_TYPE_VALUES, ALERT_TYPES, APP_USER_ROLES, CHART_PALETTE, CLIENT_CONTACT_ROLE_VALUES, CLIENT_CONTACT_ROLES, CRM_SCOPES, DEAL_STATUS_VALUES (+17 more)

### Community 60 - "Community 60"
Cohesion: 0.12
Nodes (22): @pdf-lib/fontkit, CvFonts, FONT_DIR, loadCvFonts(), readFont(), CHIP_BG, CvPdfOpties, embedPhoto() (+14 more)

### Community 61 - "Community 61"
Cohesion: 0.13
Nodes (22): GET, handle(), POST, pullMailNow(), notifyAddress(), fetchAttachments(), fetchInboxMessages(), FetchResult (+14 more)

### Community 62 - "Community 62"
Cohesion: 0.16
Nodes (18): dynamic, EvaluatiePrintPage(), metadata, dynamic, EvaluatieSjabloonPage(), metadata, EvaluatieVel(), EvaluatieWaarden (+10 more)

### Community 63 - "Community 63"
Cohesion: 0.16
Nodes (19): AppLayout(), login(), logout(), LoginForm(), dynamic, LoginPage(), metadata, register() (+11 more)

### Community 64 - "Community 64"
Cohesion: 0.10
Nodes (17): BillingForm(), PlaatsingGegevensPage(), computeEnd(), dateToIso(), DurationKind, DURATIONS, isoToDate(), Clash (+9 more)

### Community 65 - "Community 65"
Cohesion: 0.14
Nodes (21): ReceivedDetailPage(), dynamic, metadata, OntvangenFacturenPage(), ActivePlacementRef, bestMatch(), DiscrepancyMailResult, expectedForConsultantPeriod() (+13 more)

### Community 66 - "Community 66"
Cohesion: 0.13
Nodes (20): ApplicationForStalledReview, buildCertificateComplianceTasks(), buildInterviewReminderTasks(), buildStalledRecruitmentTasks(), CandidateForInterviewReminder, CandidateForStalledReview, CertificateComplianceTask, CertificateForCompliance (+12 more)

### Community 67 - "Community 67"
Cohesion: 0.14
Nodes (22): buildTargets(), CLOUD_PROVIDER_LABEL, CloudProviderChoice, CloudSummary, DEFAULT_ROOT_FOLDER, envConfig(), getCloudSummary(), hasCredentials() (+14 more)

### Community 68 - "Community 68"
Cohesion: 0.12
Nodes (22): deleteEventStay(), quickCreateEvent(), setEventStatus(), AddPopover(), AgendaCalendar(), AgendaCard(), AgendaList(), anchorStyle() (+14 more)

### Community 69 - "Community 69"
Cohesion: 0.17
Nodes (18): sendAllReminders(), sendInvoiceReminder(), sendOne(), BetaalmonitorPage(), metadata, OverdueTable(), daysOverdue(), MonitorRow (+10 more)

### Community 70 - "Community 70"
Cohesion: 0.24
Nodes (19): bulkDeleteInvoices(), bulkReleaseInvoices(), bulkSendInvoices(), deleteInvoice(), EditInvoiceSchema, removeInvoice(), revalidateFacturen(), FacturenOverzicht() (+11 more)

### Community 71 - "Community 71"
Cohesion: 0.11
Nodes (21): addCandidatePlacement(), CandidateSchema, createCandidate(), CvReadResult, deleteCandidatePlacement(), deleteCv(), deletePhoto(), saveCandidateInterviewDetails() (+13 more)

### Community 72 - "Community 72"
Cohesion: 0.15
Nodes (15): heeftAfwijkendeOvertime(), overtimeMargin(), PlaatsingenList(), PlaatsingRow, shortlistCv(), CvRow, CvsList(), optionsFrom() (+7 more)

### Community 73 - "Community 73"
Cohesion: 0.16
Nodes (17): herinnerEen(), herinnerOntbrekende(), HerinnerUitkomst, uitkomstParams(), verstuurHerinneringen(), ActivePlacementRef, findMissingTimesheets(), MissingTimesheetsResult (+9 more)

### Community 74 - "Community 74"
Cohesion: 0.09
Nodes (22): dependencies, @anthropic-ai/sdk, @aws-sdk/client-s3, clsx, date-fns, docx, fflate, lucide-react (+14 more)

### Community 75 - "Community 75"
Cohesion: 0.19
Nodes (19): reminderContent(), sendCertificateReminder(), mailFreelancerOverAfwijking(), terugNaarVoorbeeld(), notifyPendingApprovals(), NotifyResult, PendingApprovals, siteUrl() (+11 more)

### Community 76 - "Community 76"
Cohesion: 0.16
Nodes (20): createReceivedInvoice(), deleteReceivedInvoice(), parseAmount(), parseDate(), resetWeekVanuitFactuur(), revalidate(), sendDiscrepancyMail(), setReceivedStatus() (+12 more)

### Community 77 - "Community 77"
Cohesion: 0.15
Nodes (17): companyFromClient(), completeContactNoteFollowUp(), ContactNoteSchema, ContactSchema, createContact(), deleteContact(), deleteContactNote(), toData() (+9 more)

### Community 78 - "Community 78"
Cohesion: 0.17
Nodes (18): addPreset(), createRule(), deleteRule(), RuleSchema, runNow(), toggleRule(), AutomatiseringPage(), dynamic (+10 more)

### Community 79 - "Community 79"
Cohesion: 0.13
Nodes (18): deleteExpense(), setExpenseStatus(), ExpenseStatusSelect(), DeclaratieBewerkenPage(), dynamic, isoDate(), metadata, dynamic (+10 more)

### Community 80 - "Community 80"
Cohesion: 0.16
Nodes (16): saveSignature(), CopySignatureButton(), dynamic, HandtekeningPage(), metadata, SignatureCompanyForm(), defaultBadgeDataUris(), contactRow() (+8 more)

### Community 81 - "Community 81"
Cohesion: 0.14
Nodes (19): deleteEmployee(), generateMetadata(), MedewerkerBeloningPage(), EmployeeDossier, getClients, getEmployee, getNotesCount, yearStats() (+11 more)

### Community 82 - "Community 82"
Cohesion: 0.14
Nodes (15): createPost(), deletePost(), draftPost(), PostSchema, publishPost(), reopenPost(), schedulePost(), toData() (+7 more)

### Community 83 - "Community 83"
Cohesion: 0.11
Nodes (20): FacturatieArchiefPage(), archivedBillingByWeek(), ArchivedRow, ArchivedWeek, BatchResult, CompanyCosts, ConsultantFlow, ConsultantPending (+12 more)

### Community 84 - "Community 84"
Cohesion: 0.13
Nodes (15): deleteClient(), getClient, getDossierCounts, generateMetadata(), generateMetadata(), KlantDossierLayout(), generateMetadata(), KlantNotitiesPage() (+7 more)

### Community 85 - "Community 85"
Cohesion: 0.14
Nodes (14): PrintButton(), InkoopfactuurDetailPage(), metadata, TotaaloverzichtPage(), BtwOverview, BtwPeriod, BtwSource, EXPENSE_VAT_STATUSES (+6 more)

### Community 86 - "Community 86"
Cohesion: 0.15
Nodes (17): makeSlug(), MatchSchema, quickCreateVacancy(), QuickVacancySchema, runVacancyMatch(), CvGeneratorLayout(), dynamic, aiRank() (+9 more)

### Community 87 - "Community 87"
Cohesion: 0.18
Nodes (15): RFC-5545, POST(), GET, handle(), POST, icsStorageUid(), ParsedIcsEvent, parseIcs() (+7 more)

### Community 89 - "Community 89"
Cohesion: 0.13
Nodes (14): createOpportunity(), deleteOpportunity(), GENERATE_SCHEMA, GeneratedOpportunity, generateOpportunities(), OpportunitySchema, setOpportunityStatus(), toData() (+6 more)

### Community 90 - "Community 90"
Cohesion: 0.17
Nodes (15): ResetState, submitNewPassword(), dynamic, metadata, ResetPage(), ResetForm(), requestReset(), ResetRequestState (+7 more)

### Community 91 - "Community 91"
Cohesion: 0.23
Nodes (17): buildMargeOverzicht(), byName(), ClientMargin, FreelancerMargin, MARGE_LABELS, MargeLabels, MargeOverzicht, MargeRegel (+9 more)

### Community 92 - "Community 92"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 93 - "Community 93"
Cohesion: 0.16
Nodes (15): readVacatureFields(), DealForm(), leesVacature(), toDateValue(), dynamic, EditDealPage(), metadata, loadDealFormOptions() (+7 more)

### Community 94 - "Community 94"
Cohesion: 0.15
Nodes (13): addClientContact(), ClientSchema, createClient(), deleteClientContact(), QuickClientResult, QuickClientSchema, saveClientNotes(), splitName() (+5 more)

### Community 95 - "Community 95"
Cohesion: 0.20
Nodes (16): AddressLookup, escapeRegex(), lookupCompanyByWebsite(), lookupDutchAddress(), ClientForm(), autofillAddress(), fetchCompanyData(), setFieldValue() (+8 more)

### Community 96 - "Community 96"
Cohesion: 0.18
Nodes (15): approveAllAutoApproved(), AutoProcessSummary, naarWachtkamer(), parkeerInWachtkamer(), processAllAutoApproved(), processAutoApprovedToConcept(), revalidateWachtkamer(), uitWachtkamer() (+7 more)

### Community 97 - "Community 97"
Cohesion: 0.18
Nodes (15): AppShell(), HubNav(), DASHBOARD_APP, HUB_LIST, HUB_ORDER, hubForPath(), HUBS, itemIsActive() (+7 more)

### Community 98 - "Community 98"
Cohesion: 0.19
Nodes (14): GET(), buildSepaForPayables(), PayableRow, SepaBuild, ZZP_PAYMENT_TERM_DAYS, amt(), buildSepaCreditTransfer(), dateOnly() (+6 more)

### Community 99 - "Community 99"
Cohesion: 0.17
Nodes (12): Field, FormAutosave(), isToggle(), keyFor(), persistable(), setNativeChecked(), setNativeValue(), SKIP_TYPES (+4 more)

### Community 100 - "Community 100"
Cohesion: 0.22
Nodes (13): deletePlacement(), getDossierCounts, getPlacement, getTimesheets, totalHours(), generateMetadata(), generateMetadata(), PlaatsingDossierLayout() (+5 more)

### Community 101 - "Community 101"
Cohesion: 0.15
Nodes (16): add(), AgingBucket, Bar, DashboardComposition, DAYMONTH_FMT, MONTH_FMT, monthlyBuckets(), monthStart() (+8 more)

### Community 102 - "Community 102"
Cohesion: 0.15
Nodes (16): ACCENT, BOXBG, BRAND, FAINT, GHOST, INK, InvoiceDoc, InvoiceLineRow (+8 more)

### Community 103 - "Community 103"
Cohesion: 0.21
Nodes (15): API_URL, BookingInput, btwSoort(), findOrCreateRelation(), getToken(), isoDate(), pushBooking(), pushExpense() (+7 more)

### Community 104 - "Community 104"
Cohesion: 0.12
Nodes (14): Agenda, Analytics, APP_ICONS, Cvs, Data, Evaluaties, Facturatie, IconProps (+6 more)

### Community 105 - "Community 105"
Cohesion: 0.17
Nodes (11): ChallengeSchema, createChallenge(), deleteChallenge(), readOptions(), setChallengeStatus(), updateChallenge(), ChallengeForm(), metadata (+3 more)

### Community 106 - "Community 106"
Cohesion: 0.20
Nodes (13): AuthShell(), getCvLogoFile(), getLogoFile(), getLogoSrc(), IMAGE_EXT, bareTable(), heading(), NO_BORDER (+5 more)

### Community 107 - "Community 107"
Cohesion: 0.16
Nodes (11): zod, SettingsSchema, toData(), updateSettings(), createTargetClient(), TargetClientSchema, toData(), updateTargetClient() (+3 more)

### Community 108 - "Community 108"
Cohesion: 0.18
Nodes (12): CompaniesBrowser(), CompanyRow, fold(), ContactCell(), ContactRow, ContactsTable(), digitsOnly(), fold() (+4 more)

### Community 109 - "Community 109"
Cohesion: 0.22
Nodes (11): generateInvoice(), updateInvoice(), createSalesInvoice(), InvoiceResult, DUPLICAAT_FACTUURNUMMER, effectiveNextSequence(), ManualNumberResult, nextInvoiceNumber() (+3 more)

### Community 110 - "Community 110"
Cohesion: 0.22
Nodes (14): BaseSchema, buildEntries(), buildExpenses(), BuiltEntry, createTimesheet(), deleteTimesheet(), EditSchema, generateSalesForTimesheet() (+6 more)

### Community 111 - "Community 111"
Cohesion: 0.38
Nodes (12): WeekNavigator(), weekSlotVanDatum(), dagMaandFmt, dagMaandJaarFmt, mondayVanIsoWeek(), ontleedWeekKey(), volgendeWeek(), vorigeWeek() (+4 more)

### Community 112 - "Community 112"
Cohesion: 0.14
Nodes (14): scripts, build, db:push, db:reset, db:seed, db:seed-facturatie, db:seed-ontvangen, db:studio (+6 more)

### Community 113 - "Community 113"
Cohesion: 0.25
Nodes (12): addAbsence(), deleteAbsence(), addLeave(), LEAVE_TYPE_VALUES, addDays(), dutchHolidays(), easterSunday(), holidayCache (+4 more)

### Community 114 - "Community 114"
Cohesion: 0.22
Nodes (11): WachtwoordRedirect(), ForgotForm(), dynamic, ForgotPage(), metadata, addActivity(), completeActivity(), deleteActivity() (+3 more)

### Community 115 - "Community 115"
Cohesion: 0.20
Nodes (13): rejectInbox(), CONF_LABEL, DAY_LABELS, InboxDetailPage(), metadata, parseFlags(), parseReported(), prefillDays() (+5 more)

### Community 116 - "Community 116"
Cohesion: 0.19
Nodes (9): deletePurchaseInvoice(), EditPurchaseSchema, generatePurchaseInvoice(), setPurchaseInvoiceStatus(), updatePurchaseInvoice(), metadata, PrintButton(), PURCHASE_INVOICE_STATUSES (+1 more)

### Community 117 - "Community 117"
Cohesion: 0.23
Nodes (11): dynamic, metadata, StartPage(), getNavBadges(), addDays(), dayStart(), getNotifications(), hubActionCounts() (+3 more)

### Community 118 - "Community 118"
Cohesion: 0.26
Nodes (11): DocumentViewer(), AFBEELDING_MIMES, DocumentSoort, extensieVan(), MIME_PER_EXTENSIE, mimeVanBestandsnaam(), toonbaar(), veiligeBestandsnaam() (+3 more)

### Community 119 - "Community 119"
Cohesion: 0.22
Nodes (12): evaluateTimesheetGate(), GATE_MAX_WEEKLY_HOURS, GATE_MIN_HISTORY_WEEKS, GATE_MIN_WEEKLY_HOURS, GATE_RELATIVE_FACTOR, isNum(), TimesheetGateDecision, TimesheetGateInput (+4 more)

### Community 120 - "Community 120"
Cohesion: 0.26
Nodes (11): purgeArchivedItem(), archiveKey(), ArchiveSourceFile, copyArchiveFiles(), deleteArchiveFiles(), deriveLabel(), deriveSummary(), sourceFilesFor() (+3 more)

### Community 121 - "Community 121"
Cohesion: 0.21
Nodes (10): moveApplication(), moveDeal(), ACCENT, DealBoard(), move(), DealCard, DealColumn, isOverdue() (+2 more)

### Community 122 - "Community 122"
Cohesion: 0.24
Nodes (11): InkoopfacturenOverzicht(), InkoopRow, dm, dmy, Gran, GRANS, MONTHS, PeriodFilter() (+3 more)

### Community 123 - "Community 123"
Cohesion: 0.22
Nodes (11): dynamic, metadata, VacaturesMakenPage(), WEBSITE_FIELDS, fold(), Row(), stageOf(), TabKey (+3 more)

### Community 124 - "Community 124"
Cohesion: 0.29
Nodes (10): ConnectionStatus(), OfflineGuard(), Queued, isOnlineNow(), listeners, probe(), publish(), schedule() (+2 more)

### Community 125 - "Community 125"
Cohesion: 0.32
Nodes (10): cleanupFiles(), isReceivedInvoiceResettable(), mayDeleteConceptInvoice(), WeekResetResult, WeekResetRow, weekResetSummary(), resetTimesheetCore(), resetWeekForReceivedInvoice() (+2 more)

### Community 126 - "Community 126"
Cohesion: 0.28
Nodes (9): beterDan(), dedupeTimesheetsPerPersonWeek(), DubbelBasis, dubbelePersoonWeken(), dubbeleUploadLabel(), normaliseer(), Ontdubbeling, persoonSleutel() (+1 more)

### Community 127 - "Community 127"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, prisma, tailwindcss, @tailwindcss/postcss, tsx, @types/node (+4 more)

### Community 128 - "Community 128"
Cohesion: 0.24
Nodes (11): apiBaseUrl, ConnectorSchema, createConnector(), deleteConnector(), hostOf(), intakeVacancy(), makeSlug(), toData() (+3 more)

### Community 129 - "Community 129"
Cohesion: 0.26
Nodes (8): buildFreelancerDiscrepancyEmail(), FreelancerDiscrepancyEmail, FreelancerDiscrepancyInput, isNum(), MailSectie, schoon(), uren(), wijktAf()

### Community 130 - "Community 130"
Cohesion: 0.31
Nodes (10): addDays(), CLIENTS, db, main(), PEOPLE, Person, startOfISOWeek(), WeekSpec (+2 more)

### Community 131 - "Community 131"
Cohesion: 0.25
Nodes (9): readCvFields(), CandidateForm(), leesCv(), di(), setField(), WerknemerCvIntake(), choose(), lees() (+1 more)

### Community 132 - "Community 132"
Cohesion: 0.24
Nodes (8): DocUploadForm(), generateMetadata(), MedewerkerDocumentenPage(), EMPLOYEE_DOC_CATEGORIES, CERT_STATUS_META, CertStatus, EvaluationScores, SCORE_CHECKED

### Community 133 - "Community 133"
Cohesion: 0.22
Nodes (9): createStage(), deleteStage(), moveStage(), SettingsSchema, stageKey(), StageSchema, updateStage(), BADGE_COLOR_VALUES (+1 more)

### Community 134 - "Community 134"
Cohesion: 0.36
Nodes (7): setInvoiceStatus(), effectiveStatus(), FactuurDetailPage(), metadata, InvoicePreviewButton(), invoicePdfHref(), invoicePdfPreviewHref()

### Community 135 - "Community 135"
Cohesion: 0.29
Nodes (9): createChannelLinks(), createPostLink(), deletePostLink(), genToken(), safeInternalPath(), uniqueToken(), DEFAULT_CHANNEL_KEYS, RECRUITMENT_CHANNEL_VALUES (+1 more)

### Community 136 - "Community 136"
Cohesion: 0.28
Nodes (8): createEvent(), deleteEvent(), EventSchema, rescheduleEvent(), toData(), updateEvent(), EVENT_STATUS_VALUES, EVENT_TYPE_VALUES

### Community 137 - "Community 137"
Cohesion: 0.28
Nodes (8): BUCKETS, dynamic, metadata, TeDoenPage(), getOpenTasks(), OpenTask, colorFor(), hexFor()

### Community 138 - "Community 138"
Cohesion: 0.39
Nodes (8): processAll(), processConsultantFlow(), processConsultantInkoop(), processConsultantVerkoop(), revalidateVerwerken(), runProcess(), processAllPending(), processConsultant()

### Community 139 - "Community 139"
Cohesion: 0.25
Nodes (5): nextConfig, next, geistMono, metadata, sans

### Community 140 - "Community 140"
Cohesion: 0.25
Nodes (4): EvaluatiesList(), hrefWith(), metadata, metadata

### Community 141 - "Community 141"
Cohesion: 0.25
Nodes (6): setCandidateInterview(), DOT, InterviewSelect(), SHORT, TONE, CANDIDATE_INTERVIEW_STATUSES

### Community 142 - "Community 142"
Cohesion: 0.39
Nodes (5): beoordeelBestaandeUrenstaat(), BESTAANDE_URENSTAAT_NOTITIE, BestaandeUrenstaatInvoer, BestaandeUrenstaatOordeel, gevuld()

### Community 143 - "Community 143"
Cohesion: 0.29
Nodes (7): brace-expansion, brace-expansion, overrides, esbuild, minimatch@3.1.5, @typescript-eslint/typescript-estree, minimatch

### Community 144 - "Community 144"
Cohesion: 0.43
Nodes (7): marginPct(), PlaatsingenMargesPage(), createManualExpense(), readVat(), updateExpense(), MedewerkersPage(), round2()

### Community 145 - "Community 145"
Cohesion: 0.40
Nodes (5): db, main(), MONTHS, round2(), YEAR

### Community 146 - "Community 146"
Cohesion: 0.47
Nodes (5): ClientChooser(), addClient(), quickCreateClient(), ClientPicker(), addClient()

### Community 147 - "Community 147"
Cohesion: 0.40
Nodes (5): InvoiceForm(), InvoiceLineOption, metadata, NieuweFactuurPage(), toInput()

### Community 148 - "Community 148"
Cohesion: 0.33
Nodes (5): setCandidateAvailability(), DOT, SHORT, TONE, CANDIDATE_AVAILABILITY

### Community 149 - "Community 149"
Cohesion: 0.50
Nodes (4): CertificaatBewerkenPage(), dynamic, iso(), metadata

### Community 150 - "Community 150"
Cohesion: 0.70
Nodes (4): ExperienceView(), isBullet(), splitLines(), stripBullet()

### Community 151 - "Community 151"
Cohesion: 0.67
Nodes (3): db, main(), splitName()

### Community 153 - "Community 153"
Cohesion: 0.83
Nodes (4): SearchFilter(), clear(), onChange(), push()

### Community 154 - "Community 154"
Cohesion: 0.50
Nodes (3): crons, regions, $schema

### Community 155 - "Community 155"
Cohesion: 0.67
Nodes (3): optionalDependencies, @napi-rs/canvas-linux-x64-gnu, @napi-rs/canvas-linux-x64-musl

## Knowledge Gaps
- **1069 isolated node(s):** `CompanyContact`, `NaamBron`, `SortDir`, `SortKey`, `ArchiveWeek` (+1064 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1285 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db` connect `Community 4` to `Community 0`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 34`, `Community 36`, `Community 37`, `Community 39`, `Community 40`, `Community 41`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 61`, `Community 62`, `Community 63`, `Community 65`, `Community 67`, `Community 69`, `Community 70`, `Community 71`, `Community 73`, `Community 75`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`, `Community 83`, `Community 85`, `Community 86`, `Community 87`, `Community 89`, `Community 90`, `Community 93`, `Community 94`, `Community 96`, `Community 98`, `Community 100`, `Community 101`, `Community 105`, `Community 107`, `Community 108`, `Community 109`, `Community 110`, `Community 113`, `Community 114`, `Community 115`, `Community 116`, `Community 117`, `Community 120`, `Community 121`, `Community 123`, `Community 125`, `Community 128`, `Community 133`, `Community 134`, `Community 135`, `Community 136`, `Community 147`, `Community 149`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Community 6` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 25`, `Community 28`, `Community 29`, `Community 30`, `Community 37`, `Community 40`, `Community 41`, `Community 44`, `Community 45`, `Community 46`, `Community 48`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 55`, `Community 57`, `Community 63`, `Community 64`, `Community 65`, `Community 68`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`, `Community 84`, `Community 85`, `Community 86`, `Community 89`, `Community 90`, `Community 93`, `Community 94`, `Community 97`, `Community 100`, `Community 105`, `Community 106`, `Community 108`, `Community 111`, `Community 115`, `Community 116`, `Community 117`, `Community 118`, `Community 121`, `Community 122`, `Community 123`, `Community 124`, `Community 132`, `Community 134`, `Community 137`, `Community 141`, `Community 147`, `Community 148`, `Community 149`, `Community 150`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 8`, `Community 140`, `Community 12`, `Community 14`, `Community 15`, `Community 16`, `Community 18`, `Community 147`, `Community 19`, `Community 21`, `Community 22`, `Community 23`, `Community 25`, `Community 28`, `Community 29`, `Community 30`, `Community 37`, `Community 40`, `Community 42`, `Community 44`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 53`, `Community 54`, `Community 55`, `Community 64`, `Community 65`, `Community 68`, `Community 72`, `Community 76`, `Community 79`, `Community 80`, `Community 84`, `Community 88`, `Community 95`, `Community 97`, `Community 108`, `Community 115`, `Community 118`, `Community 121`, `Community 122`, `Community 123`, `Community 124`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `CompanyContact`, `NaamBron`, `SortDir` to the rest of the system?**
  _1069 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06190476190476191 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11261491317671093 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.037027579162410625 - nodes in this community are weakly interconnected._