
### Authentication

#### Admin Routes
- `POST /api/auth/admin/signup` - Register new admin
  ```json
  {
    "name": "Admin Name",
    "email": "admin@example.com",
    "password": "password123"
  }
  ```

- `POST /api/auth/admin/login` - Admin login
  ```json
  {
    "email": "admin@example.com",
    "password": "password123"
  }
  ```

#### Partner Routes
- `POST /api/auth/partner/login` - Partner login
  ```json
  {
    "email": "partner@example.com",
    "password": "password123"
  }
  ```

#### Password Reset
- `POST /api/auth/forgot-password` - Request password reset
  ```json
  {
    "email": "user@example.com",
    "role": "admin" // or "partner"
  }
  ```

- `POST /api/auth/reset-password/:role/:token` - Reset password
  ```json
  {
    "password": "newpassword123"
  }
  ```

### Partner Management (Admin Only)

- `GET /api/partners` - Get all partners with full info
- `GET /api/partners/nested` - Get all partners with nested data (names only)
- `GET /api/partners/admin` - Get partners for current admin
- `POST /api/partners` - Create new partner
  ```json
  {
    "name": "Partner Name",
    "email": "partner@example.com",
    "password": "password123"
  }
  ```
- `PUT /api/partners/:id` - Update partner
- `PUT /api/partners/:id/password` - Update partner password
- `DELETE /api/partners/:id` - Delete partner and associated data

### Customer Management (Admin Only)

- `GET /api/customers` - Get all customers with full info
- `GET /api/customers/nested` - Get all customers with nested data (names only)
- `GET /api/customers/partner/:partnerId` - Get customers for specific partner
- `POST /api/customers` - Create new customer
  ```json
  {
    "name": "Customer Name",
    "email": "customer@example.com",
    "partnerId": "partner_id"
  }
  ```
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer and associated data

### Unit Management (Admin Only)

- `GET /api/units` - Get all units
- `GET /api/units/customer/:customerId` - Get units for specific customer
- `POST /api/units` - Create new unit
  ```json
  {
    "unitName": "Unit Name",
    "customerId": "customer_id"
  }
  ```
- `PUT /api/units/:id` - Update unit
- `DELETE /api/units/:id` - Delete unit and associated data

### Report Management

#### Admin Routes
- `GET /api/reports` - Get all reports
- `POST /api/reports` - Create new report
  ```json
  {
    "reportNumber": "REP001",
    "vnNumber": "VN001",
    "pdfFile": "path/to/file.pdf",
    "adminNote": "Admin note",
    "partnerId": "partner_id",
    "customerId": "customer_id", // Optional if unitId is provided
    "unitId": "unit_id", // Optional if customerId is provided
    "status": "Active" // "Active", "Rejected", or "Completed"
  }
  ```
- `PUT /api/reports/:id` - Update report
- `DELETE /api/reports/:id` - Delete report

#### Partner Routes
- `GET /api/reports/partner` - Get partner's reports
- `PUT /api/reports/:id/partner-note` - Update partner note
  ```json
  {
    "partnerNote": "Partner note"
  }
  ```
- `POST /api/reports/:id/send` - Send report to customer

## Authentication

The API uses JWT for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_token>
```

## Data Relationships

- Admin can manage multiple Partners
- Partner belongs to one Admin
- Partner can have multiple Customers
- Customer belongs to one Partner
- Customer can have multiple Units
- Unit belongs to one Customer
- Report can be linked to either:
  - A Unit (and its Customer/Partner)
  - Directly to a Customer (and Partner)

## Cascading Deletions

- Deleting a Partner will delete all associated:
  - Customers
  - Units
  - Reports
- Deleting a Customer will delete all associated:
  - Units
  - Reports
- Deleting a Unit will delete all associated:
  - Reports

## Email Notifications

The system sends emails for:
1. Password reset requests
2. New report creation (to Partner)
3. Report sharing (to Customer)

## Error Handling

The API returns appropriate HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Development

To run in development mode with auto-reload:
```bash
npm run dev
``` #   g r d  
 