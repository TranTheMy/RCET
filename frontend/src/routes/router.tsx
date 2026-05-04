

export const ROUTER = {
    DIRECTER : {
        PROJECTMANAGERLAB: "/project-manager-lab",
        PROJECTDETAIL:"/project-detail",
        CREATEPROJECT: "/create-project",
        
    },
    LABMANAGER:{
        PROJECTMANAGERLAB: "/project-manager-lab",
        PROJECTDETAIL:"/project-detail",
        CREATEPROJECT: "/create-project",
    },
    GUEST:{
        VERILOG:"/verilog",
        VERILOG_DETAIL:"/verilog/:id",
    },
    USER:{
        LOGIN:"/login",
        REGISTER: "/register",
        FORGOTPASSWORD: "/forgot-password",
        CHANGEPASSWORD: "/change-password",
        RESETPASSWORD: "/reset-password",
        PENDINGAPPROVAL: "/pending-approval",
        AUTHCALLBACK: "/auth/callback",
        HOME:"/",
        SUBMITCV: "/submit-cv", 
        PROJECTMANAGER: "/project-manager",
        PROJECTS: "/projects",
        PROJECT_NEW: "/projects/new",
        PROJECT_DETAIL: "/projects/:id",
        RESEARCH: "/publication/research",
        RESEARCH_DETAIL: "/publication/research/:id",
        RESEARCH_SUBMIT: "/publication/research/submit",
        RESEARCH_MINE: "/publication/research/mine",
        RESEARCH_APPROVALS: "/publication/research/approvals",
        RESEARCH_WITHDRAWN: "/publication/research/withdrawn",
        INFORMATION:"/publication/information",
        USERPROFILE:"/user-profile",
        PUBLICATIONS_PRODUCT: "/publication/product",
        FORUMS:"/publication/forums",
        INFORMATION_PORTAL:"/publication/information-portal",
        /** Nội quy & quy định vận hành hệ thống */
        SYSTEM_RULES: "/publication/system-rules",
        CATEGORY: "/category",
        DASHBOARD: "/dashboard",
        DOCUMENTS: "/publication/books/documents",
        DOCUMENTS_CREATE: "/publication/books/documents/create",
        DOCUMENTS_MINE: "/publication/books/documents/mine",
        DOCUMENTS_APPROVALS: "/publication/books/documents/approvals",
        DOCUMENTS_EDIT: "/publication/books/documents/:id/edit",
        DOCUMENTS_DETAIL: "/publication/books/documents/:id",
        CURRICULUM: "/publication/curriculum",
        CURRICULUM_CREATE: "/publication/curriculum/create",
        CURRICULUM_MINE: "/publication/curriculum/mine",
        CURRICULUM_APPROVALS: "/publication/curriculum/approvals",
        CURRICULUM_EDIT: "/publication/curriculum/:id/edit",
        CURRICULUM_DETAIL: "/publication/curriculum/:id",
        CV_APPROVALS: "/publication/cv-approvals",
        CV_DETAIL: "/publication/cv-approvals/:id",
        CV_CONTRACT: "/publication/cv-approvals/:id/contract",
        /** Viện trưởng: xem nhúng file hợp đồng đã lưu */
        CV_CONTRACT_VIEW: "/publication/cv-approvals/:id/contract/view",
        /** Viện trưởng: trung tâm tác vụ (xuất bản, Verilog, danh mục, …) */
        DIRECTOR_WORKSPACE: "/workspace/vien-truong",
    },
    ADMIN: {
        ADMIN_DASHBOARD: "/admin",
        ADMIN_USERS: "/admin/users",
    }
}