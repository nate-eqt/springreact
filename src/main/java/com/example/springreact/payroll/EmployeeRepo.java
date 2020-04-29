package com.example.springreact.payroll;

import org.springframework.data.repository.CrudRepository;

public interface EmployeeRepo extends CrudRepository<Employee,Long> {}
