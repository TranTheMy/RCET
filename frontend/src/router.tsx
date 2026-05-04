import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTER } from "./routes/router";
import Login from "./Pages/auth/Login";
import Register from "./Pages/auth/Register";
import MasterLayout from "./Pages/theme/themeUser/MasterLayout";
import ForgotPassword from "./Pages/auth/ForgotPassword";
import ResetPassword from "./Pages/auth/ResetPassword";
import PendingApproval from "./Pages/auth/PendingApproval";
import AuthCallback from "./Pages/auth/AuthCallback";
import VerifyEmail from "./Pages/auth/VerifyEmail";
import ResearchSubmit from "./Pages/research/ResearchSubmit";
import MyResearchSubmissions from "./Pages/research/MyResearchSubmissions";
import ResearchApprovals from "./Pages/research/ResearchApprovals";
import ResearchWithdrawnPage from "./Pages/research/ResearchWithdrawnPage";
import ResearchDetail from "./Pages/research/ResearchDetail";
import Verilog from "./Pages/user/Verilog";
import VerilogProblemDetail from "./Pages/user/VerilogProblemDetail";
import VerilogSubmissions from "./Pages/user/VerilogSubmissions";
import VerilogManagement from "./Pages/user/VerilogManagement";
import VerilogAllSubmissions from "./Pages/user/VerilogAllSubmissions";
import ProjectManagement from "./Pages/user/ProjectManager";
import LabInformation from "./Pages/user/LabInformation";
import CreateProject from "./Pages/projects/CreateProject";
import ProjectDetail from "./Pages/projects/ProjectDetail";
import AdminDashboard from "./Pages/admin/AdminDashboard";
import AdminUsersPage from "./Pages/admin/AdminUsersPage";
import AdminAuditLogPage from "./Pages/admin/AdminAudiLog";
import AuthError from "./Pages/auth/AuthError";
import { useAuthStore } from "./store/authStore";
import { Loader2 } from "lucide-react";
import React, { lazy, Suspense, useEffect } from "react";
import AdminMasterLayout from "./Pages/theme/themeAdmin/AdminMasterLayout";
import UserProfile from "./Pages/user/UserProfile";
import DirectorWorkspace from "./Pages/user/DirectorWorkspace";
import DirectorLabStaffPage from "./Pages/user/DirectorLabStaffPage";
import Research from "./Pages/Research";
import Categories from "./Pages/user/Categories";
import UserDashboard from "./Pages/user/DashBoard";
import DocumentsPage from "./Pages/documents/DocumentsPage";
import DocumentFormPage from "./Pages/documents/DocumentFormPage";
import MyDocumentsPage from "./Pages/documents/MyDocumentsPage";
import DocumentApprovalsPage from "./Pages/documents/DocumentApprovalsPage";
import DocumentDetailPage from "./Pages/documents/DocumentDetailPage";
import CurriculumListPage from "./Pages/curriculum/CurriculumListPage";
import CurriculumFormPage from "./Pages/curriculum/CurriculumFormPage";
import MyCurriculumPage from "./Pages/curriculum/MyCurriculumPage";
import CurriculumApprovalsPage from "./Pages/curriculum/CurriculumApprovalsPage";
import CurriculumDetailPage from "./Pages/curriculum/CurriculumDetailPage";
import InformationPortal from "./Pages/user/InformationPortal";
import Forums from "./Pages/user/Forums";
import SubmitCV from "./Pages/user/SubmitCV";
import CvApprovalsPage from "./Pages/user/CvApprovalsPage";
import CvDetailPage from "./Pages/user/CvDetailPage";
import ScientistContractPage from "./Pages/user/ScientistContractPage"; 
import ScientistContractViewPage from "./Pages/user/ScientistContractViewPage";
import MyCommitments from './Pages/commitment/MyCommitments';
import SystemRulesPage from './Pages/SystemRulesPage';
import NotFound from "./Pages/NotFound";

const HomePage = lazy(() => import("./Pages/Home"));

const HomeRouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center bg-[#F8FAFC]">
    <Loader2 className="h-10 w-10 animate-spin text-cyan-500" aria-hidden />
  </div>
);


const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, initialized } = useAuthStore();
    if (!initialized) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#F37021] animate-spin" /></div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
};

const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, initialized, user } = useAuthStore();
    if (!initialized) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#F37021] animate-spin" /></div>;
    if (isAuthenticated) {
        // Nếu là admin, đưa thẳng vào Dashboard admin
        if (user?.system_role === 'admin') {
            return <Navigate to="/admin" replace />;
        }
        // Ngược lại đưa về trang chủ user
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, initialized, user } = useAuthStore();
    if (!initialized) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#F37021] animate-spin" /></div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.system_role !== 'admin') return <Navigate to="/" replace />;
    return <>{children}</>;
};

const VienTruongRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, initialized, user } = useAuthStore();
    if (!initialized) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#F37021] animate-spin" /></div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.system_role !== 'vien_truong') return <Navigate to="/" replace />;
    return <>{children}</>;
};

// Không cho admin truy cập các route chỉ dành cho user thường
const AdminLimitedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuthStore();
    if (user?.system_role === 'admin') {
        return <Navigate to="/admin" replace />;
    }
    return <>{children}</>;
};

const LabOrDirectorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, initialized, isAuthenticated } = useAuthStore();
    if (!initialized) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#F37021] animate-spin" /></div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    const r = user?.system_role;
    if (r !== 'truong_lab' && r !== 'vien_truong') return <Navigate to="/" replace />;
    return <>{children}</>;
};

/** Role `user` (cơ bản): không vào khu vực thành viên — giống phạm vi khách + hồ sơ */
const RestrictedFromBasicUser: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, initialized, isAuthenticated } = useAuthStore();
    if (!initialized) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#F37021] animate-spin" /></div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.system_role === 'user') return <Navigate to="/" replace />;
    return <>{children}</>;
};

/** Diễn đàn: API yêu cầu quyền trên `user` cơ bản — tránh trang lỗi */
const ForumsPageForRole: React.FC = () => {
    const { user } = useAuthStore();
    if (user?.system_role === 'user') return <Navigate to="/" replace />;
    return <Forums />;
};

const RenderUserRouter = () => {
    const { initialize, initialized } = useAuthStore();

    useEffect(() => {
        if (!initialized) initialize();
    }, [initialize, initialized]);

    return (
        <div>
            <Routes>
                {/* Public auth routes */}
                <Route path={ROUTER.USER.LOGIN} element={<PublicOnly><Login /></PublicOnly>} />
                <Route path={ROUTER.USER.REGISTER} element={<PublicOnly><Register /></PublicOnly>} />
                <Route path={ROUTER.USER.FORGOTPASSWORD} element={<ForgotPassword />} />
                <Route path={ROUTER.USER.RESETPASSWORD} element={<ResetPassword />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path={ROUTER.USER.PENDINGAPPROVAL} element={<PendingApproval />} />
                <Route path={ROUTER.USER.AUTHCALLBACK} element={<AuthCallback />} />
                <Route path="/auth/verify-email" element={<VerifyEmail />} />
                <Route path="/auth/error" element={<AuthError />} />

                {/* Protected routes - User layout */}
                <Route element={<MasterLayout />}>
                    {/* Public cho mọi role (Home, Research) */}
                    <Route
                        path={ROUTER.USER.HOME}
                        element={
                            <Suspense fallback={<HomeRouteFallback />}>
                                <HomePage />
                            </Suspense>
                        }
                    />
                    <Route path={ROUTER.USER.SYSTEM_RULES} element={<SystemRulesPage />} />
                    <Route path={ROUTER.USER.RESEARCH} element={<Research />} />
                    <Route
                        path={ROUTER.USER.SUBMITCV}
                        element={
                            <AdminLimitedRoute>
                                <PrivateRoute>
                                    <SubmitCV />
                                </PrivateRoute>
                            </AdminLimitedRoute>
                        }
                    />
                    <Route
                        path={ROUTER.USER.CV_APPROVALS}
                        element={
                            <AdminLimitedRoute>
                                <PrivateRoute>
                                    <LabOrDirectorRoute>
                                        <CvApprovalsPage />
                                    </LabOrDirectorRoute>
                                </PrivateRoute>
                            </AdminLimitedRoute>
                        }
                    />
                    <Route
                        path={ROUTER.USER.CV_CONTRACT_VIEW}
                        element={
                            <AdminLimitedRoute>
                                <PrivateRoute>
                                    <VienTruongRoute>
                                        <ScientistContractViewPage />
                                    </VienTruongRoute>
                                </PrivateRoute>
                            </AdminLimitedRoute>
                        }
                    />
                    <Route
                        path={ROUTER.USER.CV_CONTRACT}
                        element={
                            <AdminLimitedRoute>
                                <PrivateRoute>
                                    <VienTruongRoute>
                                        <ScientistContractPage />
                                    </VienTruongRoute>
                                </PrivateRoute>
                            </AdminLimitedRoute>
                        }
                    />
                    <Route
                        path={ROUTER.USER.CV_DETAIL}
                        element={
                            <AdminLimitedRoute>
                                <PrivateRoute>
                                    <CvDetailPage />
                                </PrivateRoute>
                            </AdminLimitedRoute>
                        }
                    />
                    <Route path={ROUTER.USER.RESEARCH_DETAIL} element={<ResearchDetail />} />
                    <Route path={ROUTER.USER.INFORMATION_PORTAL} element={<InformationPortal />} />
                    <Route path={ROUTER.USER.FORUMS} element={<ForumsPageForRole />} />
                    <Route path={ROUTER.USER.RESEARCH_SUBMIT} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><ResearchSubmit /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.RESEARCH_MINE} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><MyResearchSubmissions /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.RESEARCH_APPROVALS} element={<PrivateRoute><VienTruongRoute><ResearchApprovals /></VienTruongRoute></PrivateRoute>} />
                    <Route path={ROUTER.USER.RESEARCH_WITHDRAWN} element={<PrivateRoute><VienTruongRoute><ResearchWithdrawnPage /></VienTruongRoute></PrivateRoute>} />

                    {/* Books (Curriculum / Documents) */}
                    <Route path={ROUTER.USER.CATEGORY} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><Categories /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />

                    {/* Giáo trình (curriculum) — giống Document */}
                    <Route path={ROUTER.USER.CURRICULUM_CREATE} element={<AdminLimitedRoute><PrivateRoute><LabOrDirectorRoute><CurriculumFormPage /></LabOrDirectorRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.CURRICULUM_MINE} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><MyCurriculumPage /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.CURRICULUM_APPROVALS} element={<AdminLimitedRoute><PrivateRoute><VienTruongRoute><CurriculumApprovalsPage /></VienTruongRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.CURRICULUM_EDIT} element={<AdminLimitedRoute><PrivateRoute><LabOrDirectorRoute><CurriculumFormPage /></LabOrDirectorRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.CURRICULUM_DETAIL} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><CurriculumDetailPage /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.CURRICULUM} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><CurriculumListPage /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />

                    {/* Tài liệu kỹ thuật (documents) — route tĩnh trước :id */}
                    <Route path={ROUTER.USER.DOCUMENTS_CREATE} element={<AdminLimitedRoute><PrivateRoute><LabOrDirectorRoute><DocumentFormPage /></LabOrDirectorRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.DOCUMENTS_MINE} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><MyDocumentsPage /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.DOCUMENTS_APPROVALS} element={<AdminLimitedRoute><PrivateRoute><VienTruongRoute><DocumentApprovalsPage /></VienTruongRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.DOCUMENTS_EDIT} element={<AdminLimitedRoute><PrivateRoute><LabOrDirectorRoute><DocumentFormPage /></LabOrDirectorRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.DOCUMENTS_DETAIL} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><DocumentDetailPage /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.DOCUMENTS} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><DocumentsPage /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />

                    {/* Các route chỉ cho user thường, admin bị chặn về /admin */}
                    <Route path={ROUTER.GUEST.VERILOG} element={<AdminLimitedRoute><Verilog /></AdminLimitedRoute>} />
                    <Route path={ROUTER.GUEST.VERILOG_DETAIL} element={<AdminLimitedRoute><VerilogProblemDetail /></AdminLimitedRoute>} />
                    <Route path="/verilog/submissions" element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><VerilogSubmissions /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path="/verilog/management" element={<AdminLimitedRoute><PrivateRoute><VienTruongRoute><VerilogManagement /></VienTruongRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path="/verilog/all-submissions" element={<AdminLimitedRoute><PrivateRoute><VienTruongRoute><VerilogAllSubmissions /></VienTruongRoute></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.INFORMATION} element={<AdminLimitedRoute><LabInformation /></AdminLimitedRoute>} />
                    <Route
                      path={ROUTER.USER.CHANGEPASSWORD}
                      element={
                        <AdminLimitedRoute>
                          <Navigate to={`${ROUTER.USER.USERPROFILE}#doi-mat-khau`} replace />
                        </AdminLimitedRoute>
                      }
                    />

                    {/* Project routes chỉ cho user thường */}
                    <Route path={ROUTER.USER.PROJECTS} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><ProjectManagement /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.PROJECT_NEW} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><LabOrDirectorRoute><CreateProject /></LabOrDirectorRoute></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.PROJECT_DETAIL} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><ProjectDetail /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />

                    <Route path={ROUTER.USER.DASHBOARD} element={<AdminLimitedRoute><PrivateRoute><RestrictedFromBasicUser><UserDashboard /></RestrictedFromBasicUser></PrivateRoute></AdminLimitedRoute>} />

                    {/* Legacy routes → redirect (chỉ user thường sử dụng) */}
                    <Route path={ROUTER.USER.PROJECTMANAGER} element={<AdminLimitedRoute><Navigate to="/projects" replace /></AdminLimitedRoute>} />
                    <Route path={ROUTER.DIRECTER.PROJECTDETAIL} element={<AdminLimitedRoute><Navigate to="/projects" replace /></AdminLimitedRoute>} />
                    <Route path={ROUTER.DIRECTER.CREATEPROJECT} element={<AdminLimitedRoute><Navigate to="/projects/new" replace /></AdminLimitedRoute>} />
                    <Route path={ROUTER.LABMANAGER.PROJECTMANAGERLAB} element={<AdminLimitedRoute><Navigate to="/projects" replace /></AdminLimitedRoute>} />
                    <Route path={ROUTER.USER.USERPROFILE} element={<AdminLimitedRoute><PrivateRoute><UserProfile /></PrivateRoute></AdminLimitedRoute>} />
                    <Route
                      path={ROUTER.USER.DIRECTOR_WORKSPACE}
                      element={
                        <AdminLimitedRoute>
                          <PrivateRoute>
                            <VienTruongRoute>
                              <DirectorWorkspace />
                            </VienTruongRoute>
                          </PrivateRoute>
                        </AdminLimitedRoute>
                      }
                    />
                    <Route
                      path={ROUTER.USER.DIRECTOR_LAB_STAFF}
                      element={
                        <AdminLimitedRoute>
                          <PrivateRoute>
                            <VienTruongRoute>
                              <DirectorLabStaffPage />
                            </VienTruongRoute>
                          </PrivateRoute>
                        </AdminLimitedRoute>
                      }
                    />
                </Route>

                {/* Admin routes với layout riêng */}
                <Route element={<AdminRoute><AdminMasterLayout /></AdminRoute>}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/approvals" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<AdminUsersPage />} />
                    <Route path="/admin/security" element={<AdminAuditLogPage />} />
                </Route>
                <Route path="/my-commitments" element={<PrivateRoute><RestrictedFromBasicUser><MyCommitments /></RestrictedFromBasicUser></PrivateRoute>} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </div>
    )
};

const RouterCustom = () => {
    return RenderUserRouter();
};

export default RouterCustom;