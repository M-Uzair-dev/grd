✅ Vehicle Inspection Report Portal – Project Specification

🔐 User Roles Overview
1. Admin
Role Description:
 Full access to manage Partners, Customers, Units, and Reports. Responsible for the entire report lifecycle.
Admin Permissions:
Create/Edit/Delete Partners


Create/Edit/Delete Customers under any Partner


Create/Edit/Delete Units under Customers


Create/Edit/Delete Reports (including assigning reports to units)


Set report statuses: Active, Rejected, Completed


Add Admin Notes to Reports


Send Reports to Partners


Delete Partners (cascades deletion of Customers, Units, and Reports)


Change Partner Passwords


Admin Fields:
Name


Email


Password



2. Partner
Role Description:
 Can only view reports assigned to their customers, add a note, and forward the report to the customer via email or print/download.
Partner Permissions:
View assigned Reports


Add Partner Note to Reports


Download, Print, or Email Reports to Customers


Cannot change report status, delete reports/customers/units


Partner Fields:
Name


Email


Password


Admin ID (foreign key)



3. Customer
⚠️ Note: Customers do not have login access.
Customer Fields:
Name


Email


Partner ID (foreign key)


Units (one-to-many relationship)



📦 Data Structure Overview
1. Partner
- PartnerId (UUID or Auto-Increment)
- Name
- Email
- Password
- AdminId (foreign key)

2. Customer
- CustomerId
- Name
- Email
- PartnerId (foreign key)

3. Unit
Each customer can have multiple units. Each report is assigned to a unit.
- UnitId
- UnitName
- CustomerId (foreign key)

4. Report
Reports are added by Admins and assigned to a specific Partner → Customer → Unit.
- ReportId
- ReportNumber / VN Number
- PDF File (uploaded by Admin)
- Admin Note (text)
- Partner Note (text)
- Status: ["Active", "Rejected", "Completed"]
- PartnerId (foreign key)
- CustomerId (foreign key)
- UnitId (foreign key)


🔁 Report Lifecycle & Workflow
➤ Step 1: Admin Action
Admin uploads a PDF report


Adds an Admin Note


Selects:


Partner


Customer (under the selected Partner)


Unit (under the selected Customer)


Sets Status: Active, Rejected, or Completed


Clicks Send (with a proper of email as true or false) → Report becomes visible in the Partner's dashboard and an email is sent to the partner notifying them about the report if the email field is true


➤ Step 2: Partner Action
Partner views the report with:


Customer Name


Unit Name


Report Number


Admin Note


Status


Partner adds a Partner Note


Partner can:


Save Note


Email report to the customer (includes both Admin + Partner Notes)


Download or Print the report



🖥️ Admin Panel Pages
1. Dashboard (Main Page)
Lists all Partners


Actions: View, Create, Edit, Delete Partners


2. Partner Detail Page
Shows Partner details


Lists all Customers under the Partner


Actions: Create, Edit, Delete Customers


3. Customer Detail Page
Shows Customer details


Lists Units for the Customer


Actions: Create, Edit, Delete Units


4. Report Management Page
Upload and assign new reports


Fields: PDF File, Admin Note, VN Number, Report Number, Partner, Customer, Unit


Edit existing reports


Delete reports


Change report status


5. Partner Password Management
Reset or change Partner passwords


6. Full Delete Capability
Delete a Partner and cascade all linked Customers, Units, and Reports



🖥️ Partner Panel Pages
1. Dashboard (Main Page)
Lists all Customers under the logged-in Partner


Displays basic info: Customer Name, Email


2. Reports Page
Lists Reports assigned by Admin


Displays:


Customer Name


Unit Name


VN/Report Number


Admin Note


Status


Actions:


Add Partner Note


Save Note


Download Report


Print Report


Email Report to Customer



✉️ Email Workflow
Reports are emailed only when the Partner chooses to send it to the Customer


The email will include:


The attached PDF


Admin Note


Partner Note



🔒 Security & Access Control
Login is required for both Admins and Partners


Role-based dashboards:


Admins have full access


Partners only access reports assigned to their customers


Customers cannot log in



📌 General Notes & Terms
Design Approach:
 There is no Figma or predefined design provided. The UI will follow a standard, clean, and functional layout using general UX principles.
 Any design change requests that:


Do not affect functionality


Do not significantly improve usability


Or are purely aesthetic
 will not be accommodated, unless they break layout or impact usability.


Tech Stack:
 The application will be built using the MERN Stack:


MongoDB


Express.js


React.js


Node.js


Hosting & Domain:
 The client will provide the hosting environment and domain name. The development team will deploy the application to the provided infrastructure.


Deadline:
 The complete application is to be delivered by Sunday.


