import type { User } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from './supabase';

/**
 * Which screen is currently visible.
 * We keep this simple on purpose — no navigation library yet.
 */
type Screen =
  | 'welcome'
  | 'login'
  | 'signup'
  | 'buyer'
  | 'supplier'
  | 'createRequest'
  | 'requestDetail';

type UserRole = 'buyer' | 'supplier';

type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
};

/** A procurement request lives only in React state for this step. */
type ProcurementRequest = {
  id: string;
  commodityName: string;
  quantity: number;
  unit: string;
  grade: string;
  deliveryLocation: string;
  startingPricePerUnitInr: number;
  auctionDurationMinutes: number;
  createdAt: string;
  status: 'draft';
};

/** Form fields stay as strings while the buyer is typing. */
type RequestFormValues = {
  commodityName: string;
  quantity: string;
  unit: string;
  grade: string;
  deliveryLocation: string;
  startingPricePerUnitInr: string;
  auctionDurationMinutes: string;
};

type RequestFormErrors = {
  commodityName?: string;
  quantity?: string;
  unit?: string;
  grade?: string;
  deliveryLocation?: string;
  startingPricePerUnitInr?: string;
  auctionDurationMinutes?: string;
};

const emptyForm: RequestFormValues = {
  commodityName: '',
  quantity: '',
  unit: '',
  grade: '',
  deliveryLocation: '',
  startingPricePerUnitInr: '',
  auctionDurationMinutes: '',
};

/** Navy / white / bright-blue palette used throughout the first screens. */
const colors = {
  navy: '#0B1F3A',
  navyDeep: '#061427',
  white: '#FFFFFF',
  brightBlue: '#1E8CFF',
  brightBluePressed: '#1570D4',
  muted: '#C5D4E8',
  card: '#102A4A',
  error: '#FF8A8A',
  draft: '#7DD3FC',
  success: '#9AE6B4',
};

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('welcome');
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) ?? null;

  useEffect(() => {
    let isMounted = true;

    function applySessionUser(nextUser: User | null) {
      setUser((current) => {
        // Same auth user: keep the current object so we do not reload/create
        // the profile a second time.
        if (current?.id === nextUser?.id) {
          return current;
        }
        return nextUser;
      });
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }
        if (error) {
          applySessionUser(null);
        } else {
          applySessionUser(data.session?.user ?? null);
        }
        setSessionReady(true);
      })
      .catch(() => {
        if (isMounted) {
          applySessionUser(null);
          setSessionReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refresh is not a new login. Ignore it so we do not race two
      // profile inserts against profiles_pkey.
      if (event === 'TOKEN_REFRESHED') {
        return;
      }
      applySessionUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      setScreen((current) =>
        current === 'login' || current === 'signup' ? current : 'welcome',
      );
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    // Defer DB work so we do not deadlock inside the auth callback.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const nextProfile = await ensureProfile(user);
          if (cancelled) {
            return;
          }
          setProfile(nextProfile);
          setScreen((current) => {
            if (current === 'createRequest' || current === 'requestDetail') {
              return current;
            }
            return nextProfile.role === 'buyer' ? 'buyer' : 'supplier';
          });
        } catch (error) {
          if (!cancelled) {
            setProfile(null);
            setAuthNotice(toFriendlyError(error));
            setScreen('login');
          }
        } finally {
          if (!cancelled) {
            setProfileLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionReady, user]);

  function handleCreateRequest(newRequest: ProcurementRequest) {
    setRequests((current) => [newRequest, ...current]);
    setScreen('buyer');
  }

  function openRequestDetail(requestId: string) {
    setSelectedRequestId(requestId);
    setScreen('requestDetail');
  }

  async function handleLogout() {
    setAuthNotice(null);
    const { error } = await supabase.auth.signOut();
    setRequests([]);
    setSelectedRequestId(null);
    if (error) {
      setAuthNotice(toFriendlyError(error));
    }
  }

  const showBootLoading = !sessionReady || (user !== null && profileLoading);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {showBootLoading && (
        <ScreenShell>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brightBlue} />
            <Text style={styles.loadingText}>Checking your session…</Text>
          </View>
        </ScreenShell>
      )}

      {!showBootLoading && screen === 'welcome' && (
        <WelcomeScreen
          onLogIn={() => {
            setAuthNotice(null);
            setScreen('login');
          }}
          onSignUp={() => {
            setAuthNotice(null);
            setScreen('signup');
          }}
        />
      )}

      {!showBootLoading && screen === 'login' && (
        <LoginScreen
          notice={authNotice}
          onLoggedIn={() => setAuthNotice(null)}
          onNotice={setAuthNotice}
          onBack={() => {
            setAuthNotice(null);
            setScreen('welcome');
          }}
          onGoToSignUp={() => {
            setAuthNotice(null);
            setScreen('signup');
          }}
        />
      )}

      {!showBootLoading && screen === 'signup' && (
        <SignUpScreen
          notice={authNotice}
          onNotice={setAuthNotice}
          onNeedsEmailConfirmation={() => {
            setScreen('login');
          }}
          onBack={() => {
            setAuthNotice(null);
            setScreen('welcome');
          }}
          onGoToLogin={() => {
            setAuthNotice(null);
            setScreen('login');
          }}
        />
      )}

      {!showBootLoading && screen === 'buyer' && profile?.role === 'buyer' && (
        <BuyerDashboardScreen
          fullName={profile.full_name}
          requests={requests}
          onCreatePress={() => setScreen('createRequest')}
          onOpenRequest={openRequestDetail}
          onLogout={() => {
            void handleLogout();
          }}
        />
      )}

      {!showBootLoading && screen === 'createRequest' && profile?.role === 'buyer' && (
        <CreateRequestScreen
          onSubmit={handleCreateRequest}
          onBack={() => setScreen('buyer')}
        />
      )}

      {!showBootLoading &&
        screen === 'requestDetail' &&
        profile?.role === 'buyer' &&
        selectedRequest && (
          <RequestDetailScreen
            request={selectedRequest}
            onBack={() => setScreen('buyer')}
          />
        )}

      {!showBootLoading &&
        screen === 'supplier' &&
        profile?.role === 'supplier' && (
          <SupplierDashboardScreen
            fullName={profile.full_name}
            onLogout={() => {
              void handleLogout();
            }}
          />
        )}
    </View>
  );
}

type ScreenShellProps = {
  children: ReactNode;
};

/**
 * Pads around the notch / status bar without react-native-safe-area-context
 * (not installed) and without the deprecated React Native SafeAreaView.
 */
function ScreenShell({ children }: ScreenShellProps) {
  return <View style={styles.safeArea}>{children}</View>;
}

type WelcomeScreenProps = {
  onLogIn: () => void;
  onSignUp: () => void;
};

function WelcomeScreen({ onLogIn, onSignUp }: WelcomeScreenProps) {
  return (
    <ScreenShell>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.badge}>REVERSE AUCTIONS</Text>
          <Text style={styles.appName}>BidFlow</Text>
          <Text style={styles.subtitle}>
            Smarter procurement through real-time reverse auctions
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <PrimaryButton label="Sign up" onPress={onSignUp} />
          <PrimaryButton label="Log in" onPress={onLogIn} outlined />
        </View>
      </View>
    </ScreenShell>
  );
}

type LoginScreenProps = {
  notice: string | null;
  onLoggedIn: () => void;
  onNotice: (message: string | null) => void;
  onBack: () => void;
  onGoToSignUp: () => void;
};

function LoginScreen({
  notice,
  onLoggedIn,
  onNotice,
  onBack,
  onGoToSignUp,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    const trimmedEmail = email.trim();
    if (trimmedEmail === '' || password === '') {
      setError('Email and password are required.');
      return;
    }

    setBusy(true);
    setError(null);
    onNotice(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    setBusy(false);

    if (signInError) {
      setError(toFriendlyError(signInError));
      return;
    }

    onLoggedIn();
  }

  return (
    <AuthFormLayout
      title="Log in"
      subtitle="Use the email and password for your BidFlow account."
      notice={notice}
      error={error}
      busy={busy}
      onSubmit={() => {
        void handleLogin();
      }}
      submitLabel="Log in"
      onBack={onBack}
      footerLabel="Need an account? Sign up"
      onFooterPress={onGoToSignUp}
    >
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
      />
    </AuthFormLayout>
  );
}

type SignUpScreenProps = {
  notice: string | null;
  onNotice: (message: string | null) => void;
  onNeedsEmailConfirmation: () => void;
  onBack: () => void;
  onGoToLogin: () => void;
};

function SignUpScreen({
  notice,
  onNotice,
  onNeedsEmailConfirmation,
  onBack,
  onGoToLogin,
}: SignUpScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('buyer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName === '') {
      setError('Please enter your full name.');
      return;
    }
    if (trimmedEmail === '' || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    onNotice(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          role,
        },
      },
    });

    if (signUpError) {
      setBusy(false);
      setError(toFriendlyError(signUpError));
      return;
    }

    // Email confirmation is on: there is a user but no session yet.
    if (!data.session) {
      setBusy(false);
      onNotice(
        'Check your email to confirm your account, then log in. We will finish creating your profile after you sign in.',
      );
      onNeedsEmailConfirmation();
      return;
    }

    // A session exists. App's auth listener loads or creates the profile once.
    setBusy(false);
  }

  return (
    <AuthFormLayout
      title="Create account"
      subtitle="Choose Buyer or Supplier. This role is saved to your profile."
      notice={notice}
      error={error}
      busy={busy}
      onSubmit={() => {
        void handleSignUp();
      }}
      submitLabel={busy ? 'Creating account…' : 'Sign up'}
      onBack={onBack}
      footerLabel="Already have an account? Log in"
      onFooterPress={onGoToLogin}
    >
      <FormField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="e.g. Priya Sharma"
      />
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        secureTextEntry
        autoCapitalize="none"
      />
      <Text style={styles.fieldLabel}>I am a</Text>
      <View style={styles.roleRow}>
        <RoleChip
          label="Buyer"
          selected={role === 'buyer'}
          onPress={() => setRole('buyer')}
        />
        <RoleChip
          label="Supplier"
          selected={role === 'supplier'}
          onPress={() => setRole('supplier')}
        />
      </View>
    </AuthFormLayout>
  );
}

type AuthFormLayoutProps = {
  title: string;
  subtitle: string;
  notice: string | null;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
  submitLabel: string;
  onBack: () => void;
  footerLabel: string;
  onFooterPress: () => void;
  children: ReactNode;
};

function AuthFormLayout({
  title,
  subtitle,
  notice,
  error,
  busy,
  onSubmit,
  submitLabel,
  onBack,
  footerLabel,
  onFooterPress,
  children,
}: AuthFormLayoutProps) {
  return (
    <ScreenShell>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.page}>
          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.pageSubtitle}>{subtitle}</Text>
          {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          <View style={styles.buttonGroup}>
            <PrimaryButton
              label={busy ? 'Please wait…' : submitLabel}
              onPress={onSubmit}
              disabled={busy}
            />
            <Pressable onPress={onFooterPress} disabled={busy}>
              <Text style={styles.linkText}>{footerLabel}</Text>
            </Pressable>
            <PrimaryButton label="Back" onPress={onBack} outlined disabled={busy} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

type RoleChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function RoleChip({ label, selected, onPress }: RoleChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.roleChip, selected && styles.roleChipSelected]}
    >
      <Text style={[styles.roleChipLabel, selected && styles.roleChipLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

type BuyerDashboardScreenProps = {
  fullName: string;
  requests: ProcurementRequest[];
  onCreatePress: () => void;
  onOpenRequest: (requestId: string) => void;
  onLogout: () => void;
};

function BuyerDashboardScreen({
  fullName,
  requests,
  onCreatePress,
  onOpenRequest,
  onLogout,
}: BuyerDashboardScreenProps) {
  return (
    <ScreenShell>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Buyer Dashboard</Text>
        <Text style={styles.pageSubtitle}>
          Welcome, {fullName}. Create a procurement request, then tap a card to
          view its details. Requests stay on this device until you add cloud
          saving.
        </Text>

        <PrimaryButton
          label="Create Procurement Request"
          onPress={onCreatePress}
        />

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {requests.length === 0 ? (
            <Text style={styles.emptyText}>
              No procurement requests yet. Create one to get started.
            </Text>
          ) : (
            requests.map((request) => (
              <Pressable
                key={request.id}
                accessibilityRole="button"
                onPress={() => onOpenRequest(request.id)}
                android_ripple={{ color: 'rgba(255, 255, 255, 0.08)' }}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{request.commodityName}</Text>
                  <Text style={styles.statusBadge}>Draft</Text>
                </View>
                <Text style={styles.cardLine}>
                  Quantity: {request.quantity} {request.unit}
                </Text>
                <Text style={styles.cardLine}>
                  Starting price: {formatInr(request.startingPricePerUnitInr)} /
                  unit
                </Text>
                <Text style={styles.cardLine}>
                  Duration: {request.auctionDurationMinutes} minutes
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>

        <PrimaryButton label="Logout" onPress={onLogout} outlined />
      </View>
    </ScreenShell>
  );
}

type CreateRequestScreenProps = {
  onSubmit: (request: ProcurementRequest) => void;
  onBack: () => void;
};

function CreateRequestScreen({ onSubmit, onBack }: CreateRequestScreenProps) {
  const [values, setValues] = useState<RequestFormValues>(emptyForm);
  const [errors, setErrors] = useState<RequestFormErrors>({});

  function updateField(field: keyof RequestFormValues, text: string) {
    setValues((current) => ({ ...current, [field]: text }));
  }

  function handleSubmit() {
    const nextErrors = validateRequestForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const newRequest: ProcurementRequest = {
      id: createRequestId(),
      commodityName: values.commodityName.trim(),
      quantity: Number(values.quantity.trim()),
      unit: values.unit.trim(),
      grade: values.grade.trim(),
      deliveryLocation: values.deliveryLocation.trim(),
      startingPricePerUnitInr: Number(values.startingPricePerUnitInr.trim()),
      auctionDurationMinutes: Number(values.auctionDurationMinutes.trim()),
      createdAt: new Date().toISOString(),
      status: 'draft',
    };

    onSubmit(newRequest);
  }

  return (
    <ScreenShell>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.page}>
          <Text style={styles.pageTitle}>New Request</Text>
          <Text style={styles.pageSubtitle}>
            Fill in every field. Quantity, starting price, and duration must be
            positive numbers. This form is stored locally, not in Supabase yet.
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FormField
              label="Commodity name"
              value={values.commodityName}
              onChangeText={(text) => updateField('commodityName', text)}
              error={errors.commodityName}
              placeholder="e.g. Wheat"
            />
            <FormField
              label="Quantity"
              value={values.quantity}
              onChangeText={(text) => updateField('quantity', text)}
              error={errors.quantity}
              placeholder="e.g. 500"
              keyboardType="decimal-pad"
            />
            <FormField
              label="Unit"
              value={values.unit}
              onChangeText={(text) => updateField('unit', text)}
              error={errors.unit}
              placeholder="e.g. kg, tonnes, litres"
            />
            <FormField
              label="Grade / specification"
              value={values.grade}
              onChangeText={(text) => updateField('grade', text)}
              error={errors.grade}
              placeholder="e.g. Grade A, 12% moisture"
            />
            <FormField
              label="Delivery location"
              value={values.deliveryLocation}
              onChangeText={(text) => updateField('deliveryLocation', text)}
              error={errors.deliveryLocation}
              placeholder="e.g. Mumbai warehouse"
            />
            <FormField
              label="Starting price per unit (INR)"
              value={values.startingPricePerUnitInr}
              onChangeText={(text) =>
                updateField('startingPricePerUnitInr', text)
              }
              error={errors.startingPricePerUnitInr}
              placeholder="e.g. 42.50"
              keyboardType="decimal-pad"
            />
            <FormField
              label="Auction duration (minutes)"
              value={values.auctionDurationMinutes}
              onChangeText={(text) =>
                updateField('auctionDurationMinutes', text)
              }
              error={errors.auctionDurationMinutes}
              placeholder="e.g. 30"
              keyboardType="decimal-pad"
            />
          </ScrollView>

          <View style={styles.buttonGroup}>
            <PrimaryButton label="Submit request" onPress={handleSubmit} />
            <PrimaryButton label="Back" onPress={onBack} outlined />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

type RequestDetailScreenProps = {
  request: ProcurementRequest;
  onBack: () => void;
};

function RequestDetailScreen({ request, onBack }: RequestDetailScreenProps) {
  return (
    <ScreenShell>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>{request.commodityName}</Text>
        <Text style={styles.statusBadgeLarge}>Draft</Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          <DetailRow label="Request ID" value={request.id} />
          <DetailRow
            label="Quantity"
            value={`${request.quantity} ${request.unit}`}
          />
          <DetailRow label="Grade / specification" value={request.grade} />
          <DetailRow label="Delivery location" value={request.deliveryLocation} />
          <DetailRow
            label="Starting price per unit"
            value={formatInr(request.startingPricePerUnitInr)}
          />
          <DetailRow
            label="Auction duration"
            value={`${request.auctionDurationMinutes} minutes`}
          />
          <DetailRow
            label="Created"
            value={new Date(request.createdAt).toLocaleString()}
          />
          <DetailRow label="Status" value="Draft" />
        </ScrollView>

        <PrimaryButton label="Back" onPress={onBack} outlined />
      </View>
    </ScreenShell>
  );
}

type SupplierDashboardScreenProps = {
  fullName: string;
  onLogout: () => void;
};

function SupplierDashboardScreen({
  fullName,
  onLogout,
}: SupplierDashboardScreenProps) {
  return (
    <ScreenShell>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.appName}>Supplier Dashboard</Text>
          <Text style={styles.subtitle}>
            Welcome, {fullName}. Supplier invitations and bidding will be added
            in a later step.
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <PrimaryButton label="Logout" onPress={onLogout} outlined />
        </View>
      </View>
    </ScreenShell>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
};

function FormField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'sentences',
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  outlined?: boolean;
  disabled?: boolean;
};

function PrimaryButton({
  label,
  onPress,
  outlined = false,
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
      style={({ pressed }) => [
        styles.button,
        outlined ? styles.buttonOutlined : styles.buttonFilled,
        pressed &&
          !disabled &&
          (outlined ? styles.buttonOutlinedPressed : styles.buttonFilledPressed),
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function createRequestId(): string {
  return `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function validateRequestForm(values: RequestFormValues): RequestFormErrors {
  const errors: RequestFormErrors = {};

  if (values.commodityName.trim() === '') {
    errors.commodityName = 'Commodity name is required.';
  }
  if (parsePositiveNumber(values.quantity) === null) {
    errors.quantity = 'Enter a positive number for quantity.';
  }
  if (values.unit.trim() === '') {
    errors.unit = 'Unit is required.';
  }
  if (values.grade.trim() === '') {
    errors.grade = 'Grade / specification is required.';
  }
  if (values.deliveryLocation.trim() === '') {
    errors.deliveryLocation = 'Delivery location is required.';
  }
  if (parsePositiveNumber(values.startingPricePerUnitInr) === null) {
    errors.startingPricePerUnitInr =
      'Enter a positive number for starting price.';
  }
  if (parsePositiveNumber(values.auctionDurationMinutes) === null) {
    errors.auctionDurationMinutes =
      'Enter a positive number for auction duration.';
  }

  return errors;
}

function parseRole(value: unknown): UserRole | null {
  if (value === 'buyer' || value === 'supplier') {
    return value;
  }
  return null;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

function toProfile(row: {
  id: unknown;
  full_name: unknown;
  role: unknown;
}): Profile {
  const role = parseRole(row.role);
  if (!role || typeof row.full_name !== 'string' || typeof row.id !== 'string') {
    throw new Error(
      'Your profile data looks incomplete. Please try logging in again.',
    );
  }

  return {
    id: row.id,
    full_name: row.full_name,
    role,
  };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return toProfile(data);
}

async function createProfile(
  userId: string,
  fullName: string,
  role: UserRole,
): Promise<Profile> {
  const { error } = await supabase.from('profiles').insert({
    id: userId,
    full_name: fullName,
    role,
  });

  if (!error) {
    return {
      id: userId,
      full_name: fullName,
      role,
    };
  }

  if (isDuplicateKeyError(error)) {
    const existing = await fetchProfile(userId);
    if (existing) {
      return existing;
    }
    throw new Error(
      'Your profile already exists, but BidFlow could not load it. Please try logging in again.',
    );
  }

  throw error;
}

/** One in-flight load per user so signup + session restore cannot insert twice. */
const profileLoads = new Map<string, Promise<Profile>>();

async function loadOrCreateProfile(user: User): Promise<Profile> {
  const existing = await fetchProfile(user.id);
  if (existing) {
    // Database values win. Do not patch role or full_name from metadata.
    return existing;
  }

  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
  const role = parseRole(metadata.role);

  if (fullName === '' || role === null) {
    throw new Error(
      'Your account is signed in, but we could not find name and role details to create a profile. Sign up again or contact support.',
    );
  }

  return createProfile(user.id, fullName, role);
}

async function ensureProfile(user: User): Promise<Profile> {
  const inFlight = profileLoads.get(user.id);
  if (inFlight) {
    return inFlight;
  }

  const load = loadOrCreateProfile(user).finally(() => {
    profileLoads.delete(user.id);
  });
  profileLoads.set(user.id, load);
  return load;
}

function toFriendlyError(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email, then try logging in.';
  }
  if (lower.includes('already registered') || lower.includes('user already')) {
    return 'An account with this email already exists. Please log in.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  if (lower.includes('row-level security') || lower.includes('rls')) {
    return 'Could not save your profile. Check that signed-in users can insert their own row in public.profiles.';
  }
  if (lower.includes('profiles_pkey') || lower.includes('duplicate key')) {
    return 'Your profile already exists. BidFlow will load it instead of creating a second row.';
  }

  return message || 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navyDeep,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop:
      Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 54,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 16,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    color: colors.brightBlue,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  appName: {
    color: colors.white,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 340,
    color: colors.muted,
    fontSize: 18,
    lineHeight: 26,
  },
  pageTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  pageSubtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  noticeText: {
    marginBottom: 12,
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    flex: 1,
    marginTop: 16,
    marginBottom: 16,
  },
  listContent: {
    gap: 12,
    paddingBottom: 8,
  },
  formContent: {
    gap: 14,
    paddingBottom: 16,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(30, 140, 255, 0.25)',
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    color: colors.navyDeep,
    backgroundColor: colors.draft,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeLarge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    color: colors.navyDeep,
    backgroundColor: colors.draft,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 13,
    fontWeight: '700',
  },
  cardLine: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197, 212, 232, 0.35)',
    backgroundColor: colors.navy,
    color: colors.white,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  linkText: {
    color: colors.brightBlue,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197, 212, 232, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipSelected: {
    backgroundColor: colors.brightBlue,
    borderColor: colors.brightBlue,
  },
  roleChipLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  roleChipLabelSelected: {
    color: colors.white,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
  },
  buttonGroup: {
    gap: 12,
    paddingBottom: 8,
  },
  button: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonFilled: {
    backgroundColor: colors.brightBlue,
  },
  buttonFilledPressed: {
    backgroundColor: colors.brightBluePressed,
  },
  buttonOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.brightBlue,
  },
  buttonOutlinedPressed: {
    backgroundColor: 'rgba(30, 140, 255, 0.15)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
