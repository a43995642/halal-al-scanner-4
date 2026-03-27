
export enum HalalStatus {
  HALAL = 'HALAL',
  HARAM = 'HARAM',
  DOUBTFUL = 'DOUBTFUL',
  NON_FOOD = 'NON_FOOD'
}

export interface IngredientDetail {
  name: string;
  status: HalalStatus;
}

export interface ScanResult {
  status: HalalStatus;
  reason: string;
  ingredientsDetected: IngredientDetail[];
  confidence?: number;
  warnings?: string[];
}

export interface ScanHistoryItem {
  id: string;
  date: number;
  result: ScanResult;
  thumbnail?: string;
}

export enum CameraState {
  CLOSED,
  OPEN,
  CAPTURING
}

export type Language = 'ar' | 'en' | 'fr' | 'id' | 'tr' | 'de' | 'ru' | 'ur' | 'ms' | 'bn' | 'zh' | 'fa' | 'es' | 'hi' | 'uz' | 'kk' | 'ky' | 'so' | 'ha' | 'sw' | 'ps' | 'tl' | 'ku' | 'ml' | 'ja' | 'ko' | 'ckb' | 'kmr';

export interface TranslationDictionary {
  contains?: string;
  appTitle: string;
  appSubtitle: string;
  errorTitle: string;
  errorDesc: string;
  reload: string;
  errorDetails: string;
  cameraErrorTitle: string;
  useNativeCamera: string;
  close: string;
  flashToggle: string;
  closeCamera: string;
  captureHint: string;
  imgAdded: string;
  statusHalal: string;
  statusHaram: string;
  statusDoubtful: string;
  statusNonFood: string;
  statusUnknown: string;
  statusHalalSub: string;
  statusHaramSub: string;
  statusDoubtfulSub: string;
  statusNonFoodSub: string;
  statusUnknownSub: string;
  historyTitle: string;
  noHistory: string;
  manualInputTitle: string;
  manualInputPlaceholder: string;
  manualInputHint: string;
  analyzeTextBtn: string;
  freeScansLeft: string;
  proBadge: string;
  howItWorks: string;
  history: string;
  mainHint: string;
  btnCamera: string;
  btnGallery: string;
  btnManual: string;
  selectedImages: string;
  deleteAll: string;
  addImage: string;
  analyzingText: string;
  analyzing: string;
  moreImages: string;
  confidence: string;
  ingredientsDetected: string;
  noIngredientsFound: string;
  analyzingDeep: string;
  analyzingDesc: string;
  analysisFailed: string;
  retry: string;
  retryHighCompression: string;
  cancel: string;
  scanImagesBtn: string;
  share: string;
  newScan: string;
  resultTitle: string;
  ingredientsDetails: string;
  footerDisclaimer1: string;
  footerDisclaimer2: string;
  privacyPolicy: string;
  termsOfUse: string;
  onboardingTitle1: string;
  onboardingDesc1: string;
  onboardingTitle2: string;
  onboardingDesc2: string;
  onboardingWarning: string;
  onboardingTitle3: string;
  readCarefully: string;
  disclaimer1: string;
  disclaimer2: string;
  disclaimer3: string;
  disclaimer4: string;
  next: string;
  agree: string;
  subTitle: string;
  subTitlePro: string;
  subDesc: string;
  lifetimePlan: string;
  featureSpeed: string;
  featureSpeedDesc: string;
  featureUnlimited: string;
  featureUnlimitedDesc: string;
  featureExperience: string;
  featureExperienceDesc: string;
  featureSupport: string;
  featureSupportDesc: string;
  choosePlan: string;
  monthlyPlan: string;
  monthlyDesc: string;
  monthlyPrice: string;
  month: string;
  year: string;
  annualPlan: string;
  annualDesc: string;
  annualPrice: string;
  savePercent: string;
  bestValue: string;
  subscribeNow: string;
  restorePurchases: string;
  maxImages: string;
  onlyImages: string;
  unexpectedError: string;
  connectionError: string;
  limitReachedError: string;
  imageTooLarge: string;
  shareText: string;
  shareCopied: string;
  activating: string;
  activated: string;
  privacyTitle: string;
  privacyContent: string;
  termsTitle: string;
  termsContent: string;
  closeBtn: string;
  multiProductWarning: string;
  cameraTips: string;
  coachTapTitle: string;
  coachHoldTitle: string;
  coachAnglesTitle: string;
  gotIt: string;
  btnBarcode: string;
  barcodeTitle: string;
  barcodePlaceholder: string;
  searchBtn: string;
  barcodeNotFound: string;
  searching: string;
  productFound: string;
  // Settings & Cropper
  settingsTitle: string;
  generalSettings: string;
  language: string;
  sound: string;
  soundDesc: string;
  haptics: string;
  hapticsDesc: string;
  notifications: string;
  notificationsDesc: string;
  storage: string;
  clearHistory: string;
  clearHistoryDesc: string;
  clearHistoryConfirm: string;
  dietaryPreferences: string;
  dietaryPreferencesDesc: string;
  dietVegan: string;
  dietVegetarian: string;
  allergyGluten: string;
  allergyDairy: string;
  allergyNuts: string;
  allergyEggs: string;
  allergySoy: string;
  healthWarning: string;
  subscription: string;
  manageSubscription: string;
  appVersion: string;
  cropTitle: string;
  rotate: string;
  crop: string;
  confirm: string;
  reset: string;
  editImage: string;
  // Ingredient Language Settings
  ingredientLangTitle: string;
  ingredientLangApp: string;
  ingredientLangOriginal: string;
  ingredientLangDesc: string;
  // Account Deletion
  deleteAccount: string;
  deleteAccountDesc: string;
  deleteAccountConfirm: string;
  deleteAccountSuccess: string;
  dangerZone: string;
  // Auth
  authTitle: string;
  signIn: string;
  signUp: string;
  email: string;
  password: string;
  or: string;
  continueWithGoogle: string;
  continueWithApple: string;
  dontHaveAccount: string;
  alreadyHaveAccount: string;
  authDesc: string;
  loggingIn: string;
  signingUp: string;
  invalidEmail: string;
  weakPassword: string;
  loginSuccess: string;
  signupSuccess: string;
  signOut: string;
  exitApp: string;
  guest: string;
  registeredUser: string;
  profile: string;
  // Reporting
  reportError: string;
  reportTitle: string;
  reportDesc: string;
  correctStatus: string;
  notes: string;
  notesPlaceholder: string;
  sendReport: string;
  reportSent: string;
  // Resend Email
  resendEmail: string;
  resending: string;
  emailResent: string;
  // Auth Success Modal
  authSuccessTitle: string;
  authSuccessDesc: string;
  startScanning: string;
  today: string;
  yesterday: string;
  older: string;
  cameraPermissionError?: string;
  cameraLiveError?: string;
  cameraBrowserError?: string;
  cameraAccessError?: string;
  cameraNotFoundError?: string;
  offlineQueue?: string;
  offlineQueueTitle?: string;
  offlineWarning?: string;
  emptyQueue?: string;
  imagesToAnalyze?: string;
  textToAnalyze?: string;
  analyzeNow?: string;
  eNumbersDictionary?: string;
  searchENumbers?: string;
  noResultsFound?: string;
  updateRequired?: string;
  noInternetImage?: string;
  offlineResult?: string;
  offlineNoHaram?: string;
  haramFoundInText?: string;
  fallbackError?: string;
  safetyBlocked?: string;
  serverBusy?: string;
  overrideHaram?: string;
  overrideDoubtful?: string;
  smartHaram?: string;
  smartDoubtful?: string;
  smartHalal?: string;
  productFoundNoIngredients?: string;
  offlineSavedToQueue?: string;
  dbNotConfigured?: string;
  reportErrorMsg?: string;
  connectionFailed?: string;
  brightnessHint?: string;
  zoomHint?: string;
  switchCameraHint?: string;
  panHint?: string;
  cloudNotConfigured?: string;
  cloudNotConfiguredDesc?: string;
  continueAsGuest?: string;
  userAlreadyRegistered?: string;
  invalidCredentials?: string;
  rateLimit?: string;
  checkEmail?: string;
  checkEmailDesc?: string;
  gotItLogin?: string;
  today?: string;
  yesterday?: string;
  older?: string;
  verificationLinkSent?: string;
  pleaseCheckInbox?: string;
  closeBrowserTab?: string;
  error_noInternet?: string;
  error_timeout?: string;
  error_serverIssue?: string;
  error_failedToConnect?: string;
  error_unexpected?: string;
  storeUnavailable?: string;
  noProductsAvailable?: string;
  fullVersionActivated?: string;
  packageNotFound?: string;
  simulationPurchaseSuccess?: string;
  purchasesRestored?: string;
  noActiveSubscription?: string;
  connectingToStore?: string;
  pointCameraAt?: string;
}
