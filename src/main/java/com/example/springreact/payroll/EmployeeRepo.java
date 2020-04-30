package com.example.springreact.payroll;

import org.springframework.data.repository.PagingAndSortingRepository;

public interface EmployeeRepo extends PagingAndSortingRepository<Employee,Long> {}
