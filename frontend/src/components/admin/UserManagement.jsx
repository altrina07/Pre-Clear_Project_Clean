import { Users, Filter, Search, Edit, Eye, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import React from 'react';

export function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(null); // 'view' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ 
    id: null, 
    name: '', 
    email: '', 
    role: 'Shipper', 
    status: 'Active',
    originCountries: [],
    destinationCountries: [],
    hsCategories: []
  });

  // Filters
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    search: ''
  });

  // Available countries and HS categories for broker management (using country codes)
  const availableCountries = [
    'US', 'CA', 'MX', 'GB', 'DE', 'FR', 
    'IT', 'ES', 'NL', 'BE', 'CN', 'JP', 'KR', 
    'IN', 'AU', 'BR', 'AR', 'CL', 'CO', 'PE', 
    'AE', 'SA', 'SG', 'MY', 'TH', 'VN', 'PH', 'ID', 'NZ', 'ZA'
  ];

  const availableHsCategories = [
    '01-05', '06-15', '16-24', '25-27', '28-38', '39-40', '41-43', '44-49', 
    '50-63', '64-67', '68-71', '72-83', '84-85', '86-89', '90-97'
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.pre-clear.app/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('pc_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const usersData = await response.json();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
      // Fallback to mock data for development
      const mockUsers = [
        { 
          id: 1, 
          name: 'Test Shipper', 
          email: 'shipper@demo.com', 
          role: 'shipper', 
          status: 'active'
        },
        { 
          id: 2, 
          name: 'Demo Broker', 
          email: 'broker@demo.com', 
          role: 'broker', 
          status: 'active',
          brokerProfile: {
            originCountries: ['China', 'India', 'Vietnam'],
            destinationCountries: ['United States', 'Canada', 'European Union'],
            hsCategories: ['84-85', '39-40', '61-62']
          }
        },
        { 
          id: 3, 
          name: 'System Admin', 
          email: 'admin@demo.com', 
          role: 'admin', 
          status: 'active'
        }
      ];
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesRole = !filters.role || user.role === filters.role.toLowerCase();
    const matchesStatus = !filters.status || user.status === filters.status;
    const matchesSearch = !filters.search || 
      user.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      user.email.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesRole && matchesStatus && matchesSearch;
  });

  const openView = (user) => {
    setSelectedUser(user);
    setViewMode('view');
    setForm({ 
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      role: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Shipper',
      status: user.status === 'active' ? 'Active' : 'Inactive',
      originCountries: user.brokerProfile?.originCountries || [],
      destinationCountries: user.brokerProfile?.destinationCountries || [],
      hsCategories: user.brokerProfile?.hsCategories || []
    });
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setViewMode('edit');
    setForm({ 
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      role: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Shipper',
      status: user.status === 'active' ? 'Active' : 'Inactive',
      originCountries: user.brokerProfile?.originCountries || [],
      destinationCountries: user.brokerProfile?.destinationCountries || [],
      hsCategories: user.brokerProfile?.hsCategories || []
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((s) => ({ ...s, [name]: value }));
  };

  const toggleCountry = (field, country) => {
    setForm(prev => ({
      ...prev,
      [field === 'origin' ? 'originCountries' : 'destinationCountries']: 
        prev[field === 'origin' ? 'originCountries' : 'destinationCountries'].includes(country)
          ? prev[field === 'origin' ? 'originCountries' : 'destinationCountries'].filter(c => c !== country)
          : [...prev[field === 'origin' ? 'originCountries' : 'destinationCountries'], country]
    }));
  };

  const toggleHsCategory = (category) => {
    setForm(prev => ({
      ...prev,
      hsCategories: prev.hsCategories.includes(category)
        ? prev.hsCategories.filter(c => c !== category)
        : [...prev.hsCategories, category]
    }));
  };

  const handleCancel = () => {
    setViewMode(null);
    setSelectedUser(null);
    setForm({ 
      id: null, 
      name: '', 
      email: '', 
      role: 'Shipper', 
      status: 'Active',
      originCountries: [],
      destinationCountries: [],
      hsCategories: []
    });
  };

  const refreshUserData = async () => {
    // Fetch the latest user data and update the selected user
    try {
      const response = await fetch('https://api.pre-clear.app/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('pc_token')}`
        }
      });
      if (response.ok) {
        const usersData = await response.json();
        const updatedUser = usersData.find(u => u.id === selectedUser.id);
        if (updatedUser) {
          console.log('Updated user data:', updatedUser);
          console.log('Broker profile:', updatedUser.brokerProfile);
          setSelectedUser(updatedUser);
          // Update form to show latest data
          const brokerProfile = updatedUser.brokerProfile || {};
          setForm({
            id: updatedUser.id,
            name: updatedUser.name || '',
            email: updatedUser.email || '',
            role: updatedUser.role ? updatedUser.role.charAt(0).toUpperCase() + updatedUser.role.slice(1) : 'Shipper',
            status: updatedUser.status === 'active' ? 'Active' : 'Inactive',
            originCountries: Array.isArray(brokerProfile.originCountries) ? brokerProfile.originCountries : [],
            destinationCountries: Array.isArray(brokerProfile.destinationCountries) ? brokerProfile.destinationCountries : [],
            hsCategories: Array.isArray(brokerProfile.hsCategories) ? brokerProfile.hsCategories : []
          });
        }
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    try {
      const url = `/api/users/${form.id}`;
      const method = 'PUT';

      // Prepare user data
      const nameParts = form.name.trim().split(' ');
      const userData = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: form.email,
        role: form.role.toLowerCase(),
        isActive: form.status === 'Active',
        phone: '',
        company: ''
      };

      // If updating a broker, include broker profile data
      if (form.role === 'Broker') {
        userData.brokerProfile = {
          originCountries: form.originCountries,
          destinationCountries: [], 
          hsCategories: form.hsCategories,
          licenseNumber: '',
          yearsOfExperience: 0,
          timezone: 'UTC',
          language: 'en',
          isAvailable: true,
          maxConcurrentShipments: 10
        };
      }

      console.log('Sending user data:', userData);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('pc_token')}`
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Backend error response:', errorData);
        throw new Error('Failed to update user');
      }

      console.log('User updated successfully');
      // Refresh the full users list and update the selected user
      await loadUsers();
      await refreshUserData();
      // Keep the view mode so user can see the updated details
      setViewMode('view');
    } catch (error) {
      console.error('Failed to save user:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      alert(`Failed to update user: ${errorMsg}`);
    }
  };

  return (
    <div style={{ background: '#FBF9F6', minHeight: '100vh', padding: 24 }}>
      <div className="mb-8 flex items-center justify-between" style={{ maxWidth: '100%', marginBottom: 24 }}>
        <div>
          <h1 className="mb-2" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, color: '#2F1B17', fontSize: '1.5rem' }}>
            <Users className="w-6 h-6" style={{ color: '#3A2B28' }} />
            <span>User Management</span>
          </h1>
          <p style={{ color: '#7A5B52' }}>Manage shippers, brokers, and admins</p>
        </div>
      </div>
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <input
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select 
            name="role" 
            value={filters.role} 
            onChange={handleFilterChange} 
            className="px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Roles</option>
            <option value="shipper">Shipper</option>
            <option value="broker">Broker</option>
            <option value="admin">Admin</option>
          </select>
          <select 
            name="status" 
            value={filters.status} 
            onChange={handleFilterChange} 
            className="px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-4 px-6" style={{ color: '#7A5B52' }}>Name</th>
              <th className="text-left py-4 px-6" style={{ color: '#7A5B52' }}>Email</th>
              <th className="text-left py-4 px-6" style={{ color: '#7A5B52' }}>Role</th>
              <th className="text-left py-4 px-6" style={{ color: '#7A5B52' }}>Status</th>
              <th className="text-left py-4 px-6" style={{ color: '#7A5B52' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <React.Fragment key={user.id}>
                <tr className="border-b border-slate-100">
                  <td className="py-4 px-6 text-slate-900">{user.name}</td>
                  <td className="py-4 px-6 text-slate-700">{user.email}</td>
                  <td className="py-4 px-6">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      <button 
                        className="text-slate-600 hover:underline text-sm flex items-center gap-1" 
                        onClick={() => openView(user)}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button 
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1" 
                        onClick={() => openEdit(user)}
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Row - User Details */}
                {viewMode && selectedUser?.id === user.id && (
                  <tr className="border-b-2 border-blue-400">
                    <td colSpan="5" className="p-6 bg-blue-50">
                      <div className="max-w-4xl">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            {viewMode === 'view' ? (
                              <>
                                <Eye className="w-5 h-5" />
                                User Details
                              </>
                            ) : (
                              <>
                                <Edit className="w-5 h-5" />
                                Edit User
                              </>
                            )}
                          </h3>
                          <button 
                            onClick={handleCancel}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {viewMode === 'view' ? (
                          /* View Mode - Read Only */
                          <div className="grid grid-cols-1 gap-6">
                            {/* Basic Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                <div className="px-4 py-2 bg-white rounded-lg border border-slate-200">
                                  {form.name}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                <div className="px-4 py-2 bg-white rounded-lg border border-slate-200">
                                  {form.email}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                                <div className="px-4 py-2 bg-white rounded-lg border border-slate-200">
                                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                    {form.role}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                                <div className="px-4 py-2 bg-white rounded-lg border border-slate-200">
                                  <span className={`px-3 py-1 rounded-full text-sm ${
                                    form.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {form.status}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Broker-specific fields - View Only */}
                            {form.role === 'Broker' && (
                              <div className="border-t border-slate-200 pt-6">
                                <h4 className="text-md font-semibold text-slate-900 mb-4">Broker Configuration</h4>
                                
                                {/* Origin Countries */}
                                <div className="mb-6">
                                  <label className="block text-sm font-medium text-slate-700 mb-3">Origin Countries</label>
                                  <div className="px-4 py-3 bg-white rounded-lg border border-slate-200">
                                    {form.originCountries.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {form.originCountries.map(country => (
                                          <span key={country} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                            {country}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-500">No countries selected</span>
                                    )}
                                  </div>
                                </div>

                                {/* HS Categories */}
                                <div className="mb-6">
                                  <label className="block text-sm font-medium text-slate-700 mb-3">HS Categories</label>
                                  <div className="px-4 py-3 bg-white rounded-lg border border-slate-200">
                                    {form.hsCategories.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {form.hsCategories.map(category => (
                                          <span key={category} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                            {category}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-500">No categories selected</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-3 justify-end border-t border-slate-200 pt-4">
                              <button 
                                type="button" 
                                onClick={handleCancel} 
                                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Edit Mode - Editable Form */
                          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
                            {/* Basic Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                <input
                                  name="name"
                                  value={form.name}
                                  onChange={handleChange}
                                  placeholder="Full name"
                                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                <input
                                  name="email"
                                  value={form.email}
                                  onChange={handleChange}
                                  placeholder="Email"
                                  type="email"
                                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                                <select 
                                  name="role" 
                                  value={form.role} 
                                  onChange={handleChange} 
                                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="Shipper">Shipper</option>
                                  <option value="Broker">Broker</option>
                                  <option value="Admin">Admin</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                                <select 
                                  name="status" 
                                  value={form.status} 
                                  onChange={handleChange} 
                                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </div>
                            </div>

                            {/* Broker-specific fields */}
                            {form.role === 'Broker' && (
                              <div className="border-t border-slate-200 pt-6">
                                <h4 className="text-md font-semibold text-slate-900 mb-4">Broker Configuration</h4>
                                
                                {/* Origin Countries */}
                                <div className="mb-6">
                                  <label className="block text-sm font-medium text-slate-700 mb-3">Origin Countries</label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {availableCountries.map(country => (
                                      <label key={country} className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={form.originCountries.includes(country)}
                                          onChange={() => toggleCountry('origin', country)}
                                          className="rounded border-slate-300"
                                        />
                                        <span className="text-sm text-slate-700">{country}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* HS Categories */}
                                <div className="mb-6">
                                  <label className="block text-sm font-medium text-slate-700 mb-3">HS Categories</label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {availableHsCategories.map(category => (
                                      <label key={category} className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={form.hsCategories.includes(category)}
                                          onChange={() => toggleHsCategory(category)}
                                          className="rounded border-slate-300"
                                        />
                                        <span className="text-sm text-slate-700">{category}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-3 justify-end border-t border-slate-200 pt-4">
                              <button type="button" onClick={handleCancel} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                                Cancel
                              </button>
                              <button type="submit" className="px-4 py-2 rounded-lg text-white" style={{ background: '#E6B800', border: '2px solid #2F1B17' }}>
                                Save Changes
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

