// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // =========================================================
    // BASIC DETAILS
    // =========================================================
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    /* Self-service profile (My Profile). Avatar = small data URL,
       resized client-side; validated in user.routes.js */
    phone: { type: String, trim: true, default: "", maxlength: 20 },
    avatar: { type: String, default: null },

    /* Notifications newer than this are unread */
    notificationsReadAt: { type: Date, default: null },

    /* Workspace notification preferences (Admin Settings → Notifications).
       Read from the workspace owner; see utils/notificationSettings.js */
    notificationSettings: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
    },

    /* Two-factor authentication (TOTP). Secrets AES-GCM encrypted,
       recovery codes sha256-hashed; see utils/totp.js */
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: null, select: false },
      pendingSecret: { type: String, default: null, select: false },
      recoveryCodes: { type: [String], default: [], select: false },
      lastUsedStep: { type: Number, default: null, select: false },
      enabledAt: { type: Date, default: null },
    },

    /* Password age tracking (Security → Password Change Reminder) */
    passwordChangedAt: { type: Date, default: null },
    passwordReminderSentAt: { type: Date, default: null },

    /* Workspace security + backup preferences (stored on the owner) */
    securitySettings: {
      passwordReminder: { type: Boolean, default: false },
    },
    backupSettings: {
      autoBackup: { type: Boolean, default: false },
      restorePoints: { type: Boolean, default: false },
    },

    /* Workspace AI preferences (Admin Settings → AI Settings).
       Read from the workspace owner; see utils/aiSettings.js */
    aiSettings: {
      claude: { type: Boolean, default: true },
      suggestions: { type: Boolean, default: true },
    },

    /* Workspace integrations (Admin Settings → Integrations).
       apiKeyHash = sha256 of the workspace API key (plain key shown once) */
    integrationSettings: {
      apiAccess: { type: Boolean, default: false },
      thirdPartyApps: { type: Boolean, default: false },
      apiKeyHash: { type: String, default: null, select: false },
      apiKeyPrefix: { type: String, default: null },
      apiKeyCreatedAt: { type: Date, default: null },
    },

    passwordHash: {
      type: String,
      required: [true, "Password is required"],
    },

    // =========================================================
    // USER ROLE
    // =========================================================
    // Owning workspace (the creating admin's workspace). null = the
    // user's own workspace, or a legacy user of the default workspace.
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    role: {
      type: String,
      enum: {
        values: ["admin", "employee", "client"],
        message: "Invalid user role",
      },
      default: "client",
    },

    // =========================================================
    // DEPARTMENT
    // REQUIRED
    // =========================================================
    department: {
      type: String,
      required: [true, "Department is required"],
      enum: {
        values: [
          "Software Development",
          "UI/UX Design",
          "Digital Marketing",
          "Sales & Business Development",
          "BPO & Customer Support",
          "Human Resources",
          "Finance & Accounting",
          "Administration",
          "Quality Assurance",
          "Data & Analytics",
          "Project Management",
          "Operations",
          "Other",
        ],
        message: "Invalid department",
      },
      trim: true,
    },

    // =========================================================
    // DESIGNATION
    // REQUIRED
    // =========================================================
    designation: {
      type: String,
      required: [true, "Designation is required"],
      enum: {
        values: [
          // -----------------------------------------------------
          // Software Development
          // -----------------------------------------------------
          "Software Developer",
          "Full Stack Developer",
          "MERN Stack Developer",
          "Frontend Developer",
          "Backend Developer",
          "React Developer",
          "Node.js Developer",
          "Mobile App Developer",
          "Software Engineer",
          "Technical Lead",
          "Tech Lead",

          // -----------------------------------------------------
          // UI/UX Design
          // -----------------------------------------------------
          "UI/UX Designer",
          "UI Designer",
          "UX Designer",
          "Product Designer",
          "Graphic Designer",

          // -----------------------------------------------------
          // Digital Marketing
          // -----------------------------------------------------
          "Digital Marketing Executive",
          "Digital Marketing Manager",
          "SEO Executive",
          "SEO Specialist",
          "SEM Executive",
          "Social Media Executive",
          "Social Media Manager",
          "Content Marketing Executive",
          "Content Writer",
          "Marketing Executive",

          // -----------------------------------------------------
          // Sales / Business Development
          // -----------------------------------------------------
          "Sales Executive",
          "Sales Manager",
          "Business Development Executive",
          "Business Development Manager",
          "Relationship Manager",
          "Account Manager",

          // -----------------------------------------------------
          // BPO / Customer Support
          // -----------------------------------------------------
          "BPO Executive",
          "BPO Team Leader",
          "Customer Support Executive",
          "Customer Support Manager",
          "Telecaller",
          "Process Associate",

          // -----------------------------------------------------
          // Human Resources
          // -----------------------------------------------------
          "HR Executive",
          "HR Manager",
          "Recruiter",
          "Talent Acquisition Executive",

          // -----------------------------------------------------
          // Finance
          // -----------------------------------------------------
          "Accountant",
          "Finance Executive",
          "Finance Manager",

          // -----------------------------------------------------
          // Quality Assurance
          // -----------------------------------------------------
          "QA Tester",
          "QA Engineer",
          "QA Lead",

          // -----------------------------------------------------
          // Project Management
          // -----------------------------------------------------
          "Project Manager",
          "Project Coordinator",
          "Scrum Master",
          "Team Lead",

          // -----------------------------------------------------
          // Data
          // -----------------------------------------------------
          "Data Analyst",
          "Data Entry Operator",

          // -----------------------------------------------------
          // Administration
          // -----------------------------------------------------
          "Office Administrator",
          "Admin Executive",

          // -----------------------------------------------------
          // Operations
          // -----------------------------------------------------
          "Operations Executive",
          "Operations Manager",

          // -----------------------------------------------------
          // Common
          // -----------------------------------------------------
          "Intern",
          "Trainee",
          "Manager",
          "Senior Manager",
          "General Manager",
          "Director",
          "Other",
        ],
        message: "Invalid designation",
      },
      trim: true,
    },

    // =========================================================
    // COMPANY
    // OPTIONAL
    // =========================================================
    company: {
      type: String,
      default: null,
      trim: true,
    },

    organization: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Organization",
  default: null,
},
    // =========================================================
    // EMPLOYEE ID    

    
    // OPTIONAL
    // =========================================================
    employeeId: {
      type: String,
      default: null,
      trim: true,
    },

    // =========================================================
    // JOINING DATE
    // OPTIONAL
    // =========================================================
    joiningDate: {
      type: Date,
      default: null,
    },

    // =========================================================
    // STATUS
    // =========================================================
    isActive: {
      type: Boolean,
      default: true,
    },

    // =========================================================
    // LAST LOGIN
    // =========================================================
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// =========================================================
// HASH PASSWORD BEFORE SAVE
// =========================================================
userSchema.pre("save", async function () {
  if (!this.isModified("passwordHash")) return;

  this.passwordChangedAt = new Date();

  const salt = await bcrypt.genSalt(10);

  this.passwordHash = await bcrypt.hash(
    this.passwordHash,
    salt
  );
});

// =========================================================
// COMPARE PASSWORD
// =========================================================
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(
    password,
    this.passwordHash
  );
};

// =========================================================
// REMOVE PASSWORD FROM JSON RESPONSE
// =========================================================
userSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.passwordHash;

  // Never expose 2FA material, even when explicitly selected
  if (obj.twoFactor) obj.twoFactor = { enabled: !!obj.twoFactor.enabled, enabledAt: obj.twoFactor.enabledAt || null };
  if (obj.integrationSettings) delete obj.integrationSettings.apiKeyHash;

  return obj;
};

// =========================================================
// CREATE SUPER ADMIN IF NOT EXISTS
// =========================================================
userSchema.statics.createAdminIfNotExists = async function () {
  const adminEmail = "siva@readytechsolutions.in";

  const existingAdmin = await this.findOne({
    email: adminEmail,
  });

  if (!existingAdmin) {
    const admin = new this({
      name: "Super Admin",
      email: adminEmail,
      passwordHash: "siva@123",
      role: "admin",

      // REQUIRED FIELDS
      department: "Administration",
      designation: "Director",

      // OPTIONAL FIELDS
      company: "Ready Tech Solutions",
      employeeId: null,
      joiningDate: null,

      isActive: true,
    });

    await admin.save();

    console.log("✅ Super Admin created");
  } else {
    console.log("ℹ️ Super Admin already exists");
  }
};

export default mongoose.model("User", userSchema);