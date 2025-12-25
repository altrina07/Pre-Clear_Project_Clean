import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate } from "react-router-dom";
import { getShipmentById } from "./api/shipments";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { SignupPage } from "./components/SignupPage";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./contexts/AuthContext";
import { Settings } from "./components/Settings";

// Add ProfilePage import
import { ProfilePage } from "./components/ProfilePage";

// Shipper Pages
import { ShipperDashboard } from "./components/shipper/ShipperDashboard";
// CreateShipment removed - use new ShipmentForm
import { ShipmentDetails } from "./components/shipper/ShipmentDetails";
import { UploadDocuments } from "./components/shipper/UploadDocuments";
import { AIEvaluationStatus } from "./components/shipper/AIEvaluationStatus";
import { RequestBrokerApproval } from "./components/shipper/RequestBrokerApproval";
import { ChatNotifications } from "./components/shipper/ChatNotifications";
import { ShipmentToken } from "./components/shipper/ShipmentToken";
import { ShipmentTokenList } from "./components/shipper/ShipmentTokenList";
import { ShipmentForm } from "./components/shipper/ShipmentForm";
import { createDefaultShipment } from "./store/shipmentsStore";
import { ShipmentBooking } from "./components/shipper/ShipmentBooking";
import { PaymentPage } from "./components/shipper/PaymentPage";
import { PaymentList } from "./components/shipper/PaymentList";
import { ShipperProfile } from "./components/shipper/ShipperProfile";
import { BookedPaidShipments } from "./components/shipper/BookedPaidShipments";
import { BookedShipmentDetails } from "./components/shipper/BookedShipmentDetails";

// Broker Pages
import { BrokerDashboard } from "./components/broker/BrokerDashboard";
import { PendingReview } from "./components/broker/PendingReview";
import { ApprovedShipments } from "./components/broker/ApprovedShipments";
import { BrokerReviewShipment } from "./components/broker/BrokerReviewShipment";
import { DocumentReview } from "./components/broker/DocumentReview";
import { RequestDocuments } from "./components/broker/RequestDocuments";
import { BrokerChat } from "./components/broker/BrokerChat";
import { BrokerProfile } from "./components/broker/BrokerProfile";
import ApprovedShipviewpg from "./components/broker/ApprovedShipviewpg";

// Notifications
import { NotificationsPage } from "./components/NotificationsPage";

// Admin Pages
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { UserManagement } from "./components/admin/UserManagement";
import { SystemConfig } from "./components/admin/SystemConfig";
import { AIRulesMonitoring } from "./components/admin/AIRulesMonitoring";
import { ShipmentTracking } from "./components/admin/ShipmentTracking";
import { clearAuthToken } from "./api/http";
import { shipmentsStore } from "./store/shipmentsStore";
import { getProfile } from "./api/auth";

function AppShell() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState("home");
  const [currentShipment, setCurrentShipment] = useState(null);
  const navigate = useNavigate();
  const { id: shipmentIdFromRoute } = useParams();
  const location = useLocation();

  const handleLogin = async (role) => {
    // Fresh session: ensure local state is clean and then navigate
    shipmentsStore.clearShipments();
    setUserRole(role);
    setIsLoggedIn(true);
    setCurrentPage("dashboard");
    setCurrentShipment(null);
    // Always land on dashboard route after login (clear deep links)
    try {
      navigate("/", { replace: true });
    } catch {}
    
    // Fetch user profile information
    try {
      const profileData = await getProfile();
      setUserInfo(profileData);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // Set basic user info if profile fetch fails
      setUserInfo({ firstName: 'User', email: 'user@example.com' });
    }
  };

  const handleLogout = () => {
    // Clear auth + shipment state when logging out
    try { clearAuthToken(); } catch {}
    try { localStorage.removeItem('pc_userId'); } catch {}
    shipmentsStore.clearShipments();
    setIsLoggedIn(false);
    setUserRole("");
    setUserInfo(null);
    setCurrentPage("login");
    setCurrentShipment(null);
  };

  // Global unauthorized handling: listen for JWT failures and force login
  useEffect(() => {
    const onUnauthorized = () => {
      try { clearAuthToken(); } catch {}
      try { localStorage.removeItem('pc_userId'); } catch {}
      shipmentsStore.clearShipments();
      setIsLoggedIn(false);
      setUserRole("");
      setCurrentPage("login");
    };
    window.addEventListener('pc-auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pc-auth:unauthorized', onUnauthorized);
  }, []);

  // Handle direct access to /shipments/:id route
  useEffect(() => {
    if (shipmentIdFromRoute && isLoggedIn && userRole === 'shipper') {
      console.log('[AppShell] Direct route to /shipments/' + shipmentIdFromRoute);
      setCurrentPage('shipment-details');
      // Fetch shipment data in background
      const shipmentFromNav = location.state?.shipment;
      if (!shipmentFromNav) {
        const fetchShipment = async () => {
          try {
            const data = await getShipmentById(shipmentIdFromRoute);
            const extractedShipment = data?.Shipment || data?.shipment || data;
            setCurrentShipment(extractedShipment);
          } catch (err) {
            console.error('[AppShell] Error fetching shipment:', err);
          }
        };
        fetchShipment();
      } else {
        setCurrentShipment(shipmentFromNav);
      }
    }
  }, [shipmentIdFromRoute, isLoggedIn, userRole, location.state?.shipment]);

  // Handle direct access to /shipper/notifications or /broker/notifications route
  useEffect(() => {
    if (location.pathname.includes('/notifications') && isLoggedIn) {
      console.log('[AppShell] Direct route to notifications');
      setCurrentPage('notifications');
    }
  }, [location.pathname, isLoggedIn]);

  const handleNavigate = (page, data) => {
    console.log('[App.handleNavigate] Called with:', { page, data });
    console.log('[App.handleNavigate] - data.id:', data?.id);
    console.log('[App.handleNavigate] - data.Id:', data?.Id);
    console.log('[App.handleNavigate] - data.referenceId:', data?.referenceId);
    console.log('[App.handleNavigate] - data.reference_id:', data?.reference_id);
    
    // Hard guard: prevent navigation when data.id is missing
    if (page === 'shipment-details' && (!data || !data.id)) {
      console.warn('[App.handleNavigate] Navigation to shipment-details blocked: missing shipment id');
      return;
    }
    
    if (data) {
      setCurrentShipment(data);
    }

    // Route shipment details to URL-based route with id param
    if (page === "shipment-details" && data?.id) {
      console.log('[App.handleNavigate] Navigating to /shipments/' + data.id);
      navigate(`/shipments/${data.id}`, { state: { shipment: data } });
      return;
    }

    console.log('[App.handleNavigate] Setting currentPage to:', page);
    setCurrentPage(page);
  };

  const renderShipperPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <ShipperDashboard onNavigate={handleNavigate} />;
      case "create-shipment":
        return (
          <ShipmentForm
            shipment={null}
            onNavigate={handleNavigate}
          />
        );
      case "shipment-details":
        return (
          <ShipmentDetails
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "upload-documents":
        return (
          <UploadDocuments
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "ai-evaluation":
        return (
          <AIEvaluationStatus
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "request-broker":
        return (
          <RequestBrokerApproval
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "chat":
        return (
          <ChatNotifications shipment={currentShipment} onNavigate={handleNavigate} />
        );
      case "shipment-token":
        return (
          <ShipmentToken
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "shipment-token-list":
        return (
          <ShipmentTokenList onNavigate={handleNavigate} />
        );
      case "shipment-form":
        return (
          <ShipmentForm
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "booking":
        return (
          <ShipmentBooking
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "payment":
        return (
          <PaymentPage
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "payment-list":
        return <PaymentList onNavigate={handleNavigate} />;
      case "booked-paid":
        return <BookedPaidShipments onNavigate={handleNavigate} />;
      case "booked-shipment-details":
        return (
          <BookedShipmentDetails
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "profile":
        return <ProfilePage userRole={userRole} onLogout={handleLogout} />;
      case "notifications":
        return <NotificationsPage userRole="shipper" onNavigate={handleNavigate} />;
      default:
        return <ShipperDashboard onNavigate={handleNavigate} />;
    }
  };

  const renderBrokerPage = () => {
    switch (currentPage) {
      case "dashboard":
      case "broker-dashboard":
        return <BrokerDashboard onNavigate={handleNavigate} />;
      case "pending-review":
        return <PendingReview onNavigate={handleNavigate} />;
      case "approved-shipments":
        return <ApprovedShipments onNavigate={handleNavigate} />;
      case "broker-review":
        return (
          <BrokerReviewShipment
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "approved-shipview":
        return (
          <ApprovedShipviewpg
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "document-review":
        return (
          <DocumentReview
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "request-documents":
        return (
          <RequestDocuments
            shipment={currentShipment}
            onNavigate={handleNavigate}
          />
        );
      case "chat":
        return <BrokerChat onNavigate={handleNavigate} />;
      case "profile":
        return <ProfilePage userRole={userRole} onLogout={handleLogout} />;
      case "notifications":
        return <NotificationsPage userRole="broker" onNavigate={handleNavigate} />;
      default:
        return <BrokerDashboard onNavigate={handleNavigate} />;
    }
  };

  const renderAdminPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <AdminDashboard onNavigate={handleNavigate} />;
      case "user-management":
        return <UserManagement />;
      case "system-config":
        return <SystemConfig />;
      case "ai-monitoring":
        return <AIRulesMonitoring />;
      case "tracking":
        return <ShipmentTracking />;
      case "admin-profile":
        return <ProfilePage userRole={userRole} onLogout={handleLogout} />;
      default:
        return <AdminDashboard onNavigate={handleNavigate} />;
    }
  };

  const renderPage = () => {
    if (userRole === "shipper") return renderShipperPage();
    if (userRole === "broker") return renderBrokerPage();
    if (userRole === "admin") return renderAdminPage();
    return <ShipperDashboard onNavigate={handleNavigate} />;
  };

  // Show HomePage by default
  if (!isLoggedIn && currentPage === "home") {
    return <HomePage onLogin={() => setCurrentPage("login")} onSignup={() => setCurrentPage("signup")} />;
  }

  // Show LoginPage when navigated to
  if (!isLoggedIn && currentPage === "login") {
    return <LoginPage onLogin={handleLogin} onNavigate={setCurrentPage} />;
  }

  // Show SignupPage when navigated to
  if (!isLoggedIn && currentPage === "signup") {
    return <SignupPage onNavigate={setCurrentPage} />;
  }

  // Show app with layout when logged in
  return (
    <Layout
      userRole={userRole}
      currentPage={currentPage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userInfo={userInfo}
    >
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/shipper/shipments/:id" element={<AppShell />} />
          <Route path="/shipper/notifications" element={<AppShell />} />
          <Route path="/broker/review/:id" element={<AppShell />} />
          <Route path="/broker/notifications" element={<AppShell />} />
          <Route path="/shipments/:id" element={<AppShell />} />
          <Route path="/*" element={<AppShell />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}