import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../App'
import StudentList from './StudentList'
import axios from 'axios'
import Loader from './Loader'
import home from '../assets/home.svg'
import { useNavigate } from 'react-router-dom'

const getStudents = ()=>{
  return JSON.parse(localStorage.getItem('searchStudents')) || []
}
const Search = () => {
  const goto=useNavigate()
  const { checkAuthState } = useContext(AppContext)
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState(getStudents())
  const [year, setYear] = useState("TE")
  const [div, setDiv] = useState("A")
  const [search, setSearch] = useState("")
  const [studentList, setStudentList] = useState(students)
  const handleSearch = (e) => {
    let tempStud = []
    setSearch(e.target.value)
    students.forEach(stu => {
      if (stu.name.includes(search)) {
        tempStud.push(stu)
      }
    })
    setStudentList(tempStud)
    // console.log(studentList)
  }
  const handleBlur = () => {
    setTimeout(() => {
      setStudentList(students)
    }, 1000)
  }
  const fetchStudents = async () => {
    const values = { year, div }
    try{
      let { data } = await axios.get(`http://localhost:8080/api/search_students`,
      { params: values }
      )
      setLoading(true)
      console.log(data)
      setLoading(false)
      setStudents(data)
      setStudentList(data)
    }catch(err){
      console.log(err)
    }
  }
  useEffect(() => {
    studentList.length===0 && fetchStudents()
    studentList.length!==0 && setLoading(false)
    checkAuthState()
  }, [])
  useEffect(() => {
    localStorage.setItem('searchStudents',JSON.stringify(students))
  }, [students])
  return (
    loading ?

      <Loader /> :

      <section className='flex flex-col gap-3 my-8 px-6'>
        {/* <button className='flex self-start' onClick={()=>goto('/selection')}>
          <img src={home} className='w-6' alt="home" />
        </button> */}
        <button className='text-gray-600 text-3xl self-start' onClick={()=>goto('/selection')}>&larr;</button>
        <div className='flex justify-between'>
          <select name="year" id="year" value={year} onChange={(e) => setYear(e.target.value)} className='w-1/2 p-2 rounded-lg focus:outline-none bg-inherit border-2 border-gray-400'>
            <option value="SE">SE</option>
            <option value="TE">TE</option>
            <option value="BE">BE</option>
          </select>
          <select name="div" id="div" value={div} onChange={(e) => setDiv(e.target.value)} className='w-1/2 p-2 rounded-lg focus:outline-none bg-inherit border-2 border-gray-400 ml-2'>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="C">D</option>
          </select>
          <button className='bg-[var(--primary)] ml-3 text-white px-3 rounded-lg' onClick={()=>fetchStudents()}>Search</button>
        </div>

        <form>
          <input type="text" onBlur={handleBlur} placeholder='Search by student Name' value={search} className='w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:outline-none' onChange={handleSearch} />
          <div className='flex flex-col gap-2 mt-4'>
            {
              studentList?.map((s, key) => {
                return (<StudentList key={key} id={key} name={s.name} roll={s.roll} check={false} />)
              })
            }
          </div>
        </form>

        <div>

        </div>
      </section>
  )
}

export default Search
